import Post from "./post.model.js";
import User from "../auth/user.model.js";
import cloudinary from "../../config/cloudinary.js";
import { getNotificationService } from "../../socket/socket.handlers.js";
import { broadcast } from "../../socket/realtime.js";

const uploadToCloudinary = (buffer, resourceType, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          resource_type: resourceType,
          folder: folder,
          transformation:
            resourceType === "video"
              ? [{ quality: "auto", format: "mp4" }]
              : [
                  {
                    quality: "auto",
                    format: "jpg",
                    width: 1200,
                    height: 1200,
                    crop: "limit",
                  },
                ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      )
      .end(buffer);
  });
};

export async function CreatePost(req, res) {
  try {
    const { content } = req.body;
    const userId = req.user.id;

    if (!content) {
      return res
        .status(400)
        .json({ success: false, message: "Content is required" });
    }

    let mediaData = { type: "none", url: "", publicId: "" };

    if (req.file) {
      const isVideo = req.file.mimetype.startsWith("video/");
      const resourceType = isVideo ? "video" : "image";
      const folder = isVideo ? "social_app/videos" : "social_app/images";

      try {
        const result = await uploadToCloudinary(
          req.file.buffer,
          resourceType,
          folder,
        );
        mediaData = {
          type: isVideo ? "video" : "image",
          url: result.secure_url,
          publicId: result.public_id,
        };
      } catch (uploadError) {
        console.error("Cloudinary upload error:", uploadError);
        return res
          .status(500)
          .json({ success: false, message: "Failed to upload media" });
      }
    }

    const newPost = new Post({ author: userId, content, media: mediaData });
    await newPost.save();

    await User.findByIdAndUpdate(userId, { $push: { posts: newPost._id } });
    await newPost.populate(
      "author",
      "username profile.name profile.profileImage",
    );

    broadcast("post:created", { post: newPost });

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: newPost,
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while creating post" });
  }
}

export async function getFeed(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find()
      .populate("author", "username profile.name profile.profileImage")
      .populate("comments.user", "username profile.name profile.profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      posts,
      currentPage: page,
      hasMore: posts.length === limit,
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while fetching posts" });
  }
}

export async function searchPosts(req, res) {
  try {
    const query = (req.params.query || "").trim();
    if (!query) {
      return res.status(400).json({ success: false, message: "Search query is required" });
    }

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const posts = await Post.find({ content: { $regex: escaped, $options: "i" } })
      .populate("author", "username profile.name profile.profileImage")
      .populate("comments.user", "username profile.name profile.profileImage")
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, posts });
  } catch (error) {
    console.error("Error searching posts:", error);
    res.status(500).json({ success: false, message: "Server error while searching posts" });
  }
}

export async function SinglePost(req, res) {
  try {
    const post = await Post.findById(req.params.postId)
      .populate("author", "username profile.name profile.profileImage")
      .populate("comments.user", "username profile.name profile.profileImage")
      .populate("likes", "username profile.name profile.profileImage");

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    res.status(200).json({ success: true, post });
  } catch (error) {
    console.error("Error fetching post:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while fetching post" });
  }
}

export async function likePost(req, res) {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    const post = await Post.findById(postId).select("author likes").lean();
    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    // Atomic toggle — rapid double taps can't double-count
    const wasLiked = post.likes.some((id) => String(id) === String(userId));
    const updated = await Post.findByIdAndUpdate(
      postId,
      wasLiked ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } },
      { new: true, select: "likes" },
    ).lean();
    const isLiked = !wasLiked;
    const likesCount = updated?.likes?.length ?? 0;

    broadcast("post:likes", { postId: String(postId), likesCount, userId: String(userId), liked: isLiked });

    if (isLiked) {
      const notificationService = getNotificationService();
      if (notificationService) {
        const liker = await User.findById(userId).select("username").lean();
        notificationService
          .sendLikeNotification(post.author, userId, liker?.username || "Someone", postId)
          .catch((error) => console.error("Like notification failed:", error.message));
      }
    }

    res.status(200).json({
      success: true,
      message: isLiked ? "Post liked" : "Post unliked",
      isLiked,
      likesCount,
    });
  } catch (error) {
    console.error("Error liking/unliking post:", error);
    res.status(500).json({
      success: false,
      message: "Server error while processing like",
    });
  }
}

export async function addComment(req, res) {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;
    const { text } = req.body;

    if (!text) {
      return res
        .status(400)
        .json({ success: false, message: "Comment text is required" });
    }

    const post = await Post.findById(postId).populate("author", "username");

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    post.comments.push({ user: userId, text, createdAt: new Date() });
    await post.save();

    await post.populate(
      "comments.user",
      "username profile.name profile.profileImage",
    );

    const addedComment = post.comments[post.comments.length - 1];

    const notificationService = getNotificationService();
    if (notificationService) {
      const commenter = await User.findById(userId);
      await notificationService.sendCommentNotification(
        post.author._id,
        userId,
        commenter.username,
        postId,
      );
    }

    broadcast("post:comment", {
      postId: String(postId),
      comment: addedComment,
      commentsCount: post.comments.length,
    });

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      comment: addedComment,
      commentsCount: post.comments.length,
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while adding comment" });
  }
}

export async function DeletePost(req, res) {
  try {
    const postId = req.params.postId;
    const userId = req.user.id;

    const post = await Post.findById(postId);

    if (!post) {
      return res
        .status(404)
        .json({ success: false, message: "Post not found" });
    }

    if (post.author.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own posts",
      });
    }

    if (post.media.publicId) {
      try {
        await cloudinary.uploader.destroy(post.media.publicId, {
          resource_type: post.media.type === "video" ? "video" : "image",
        });
      } catch (cloudinaryError) {
        console.error("Error deleting from cloudinary:", cloudinaryError);
      }
    }

    await User.findByIdAndUpdate(userId, { $pull: { posts: postId } });
    await Post.findByIdAndDelete(postId);
    broadcast("post:deleted", { postId: String(postId), authorId: String(post.author) });

    res
      .status(200)
      .json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while deleting post" });
  }
}

export async function getUserpost(req, res) {
  try {
    const { username } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const user = await User.findOne({ username });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const posts = await Post.find({ author: user._id })
      .populate("author", "username profile.name profile.profileImage")
      .populate("comments.user", "username profile.name profile.profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      posts,
      currentPage: page,
      hasMore: posts.length === limit,
    });
  } catch (error) {
    console.error("Error fetching user posts:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user posts",
    });
  }
}
