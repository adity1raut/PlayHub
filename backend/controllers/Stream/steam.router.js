import Stream from "../../models/Sream.models.js";
import User from "../../models/User.models.js";
import LiveMessage from "../../models/StreamChat.models.js";
import { getNotificationService } from "../../socket/socketHandlers.js";

// Create a new stream - requires authentication
export async function createStream(req, res) {
  try {
    const { title, description } = req.body;
    const host = req.user._id; // Get host from authenticated user

    // Verify host exists
    const hostUser = await User.findById(host).populate("followers", "_id");
    if (!hostUser) {
      return res.status(404).json({ error: "Host user not found" });
    }

    const streamKey = `${host}-${Date.now()}`;

    const newStream = new Stream({
      host,
      title,
      description,
      streamKey,
      streamUrl: `/live/${streamKey}`, // later CDN/RTMP linkz
      isLive: true,
      startedAt: new Date(),
    });

    await newStream.save();

    // Add stream to user's streams array
    await User.findByIdAndUpdate(host, {
      $push: { streams: newStream._id },
    });

    // Send notifications to followers about stream start
    const notificationService = getNotificationService();
    if (
      notificationService &&
      hostUser.followers &&
      hostUser.followers.length > 0
    ) {
      for (const follower of hostUser.followers) {
        try {
          await notificationService.createNotification(
            follower._id,
            "STREAM_START",
            `${hostUser.username || hostUser.profile?.name} started a live stream: ${title}`,
            `/stream/${newStream._id}`,
            host,
          );
        } catch (error) {
          console.error("Error sending stream notification:", error);
        }
      }
    }

    res.status(201).json(newStream);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get all live streams - public access
export async function getAllLiveStreams(req, res) {
  try {
    const streams = await Stream.find({ isLive: true }).populate(
      "host",
      "username profile.profileImage profile.name",
    );
    res.json(streams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get specific stream - public access for viewing
export async function getStreamById(req, res) {
  try {
    const stream = await Stream.findById(req.params.id)
      .populate("host", "username profile.profileImage profile.name")
      .populate("viewers", "username profile.profileImage profile.name")
      .populate({
        path: "liveChat",
        populate: {
          path: "sender",
          select: "username profile.profileImage profile.name",
        },
        options: { sort: { createdAt: -1 }, limit: 50 }, // Latest 50 messages
      });

    if (!stream) return res.status(404).json({ message: "Stream not found" });

    res.json(stream);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// End stream - only stream host can end
export async function endStream(req, res) {
  try {
    const stream = await Stream.findById(req.params.id).populate(
      "viewers",
      "_id",
    );
    if (!stream) return res.status(404).json({ message: "Stream not found" });

    // Check if user is the host
    if (stream.host.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the host can end the stream" });
    }

    stream.isLive = false;
    stream.endedAt = new Date();
    await stream.save();

    // Notify all viewers that stream ended
    const notificationService = getNotificationService();
    if (notificationService && stream.viewers && stream.viewers.length > 0) {
      const hostUser = await User.findById(stream.host);

      for (const viewer of stream.viewers) {
        try {
          await notificationService.createNotification(
            viewer._id,
            "GENERAL",
            `${hostUser.username || hostUser.profile?.name}'s stream has ended`,
            `/stream/${stream._id}`,
            stream.host,
          );
        } catch (error) {
          console.error("Error sending stream end notification:", error);
        }
      }

      // Emit real-time stream end event
      if (notificationService.io) {
        notificationService.io.to(`stream_${stream._id}`).emit("stream-ended", {
          streamId: stream._id,
          message: "Stream has ended",
          timestamp: new Date(),
        });
      }
    }

    res.json({ message: "Stream ended", stream });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Join stream - requires authentication
export async function joinStream(req, res) {
  try {
    const userId = req.user._id; // Get user from token
    const streamId = req.params.id;

    const stream = await Stream.findById(streamId).populate(
      "host",
      "username profile",
    );
    if (!stream) return res.status(404).json({ message: "Stream not found" });

    if (!stream.isLive) {
      return res.status(400).json({ message: "Stream is not live" });
    }

    if (!stream.viewers.includes(userId)) {
      stream.viewers.push(userId);
      await stream.save();

      // Notify stream host about new viewer
      const notificationService = getNotificationService();
      if (
        notificationService &&
        stream.host._id.toString() !== userId.toString()
      ) {
        const viewer = await User.findById(userId);
        try {
          await notificationService.createNotification(
            stream.host._id,
            "GENERAL",
            `${viewer.username || viewer.profile?.name} joined your stream`,
            `/stream/${streamId}`,
            userId,
          );
        } catch (error) {
          console.error("Error sending viewer notification:", error);
        }
      }
    }

    res.json({ message: "Joined stream", viewers: stream.viewers.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Leave stream - requires authentication
export async function leaveStream(req, res) {
  try {
    const userId = req.user._id; // Get user from token
    const stream = await Stream.findById(req.params.id);
    if (!stream) return res.status(404).json({ message: "Stream not found" });

    stream.viewers = stream.viewers.filter(
      (v) => v.toString() !== userId.toString(),
    );
    await stream.save();

    res.json({ message: "Left stream", viewers: stream.viewers.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Send chat message - requires authentication
export async function sendChatMessage(req, res) {
  try {
    const { message } = req.body;
    const streamId = req.params.id;
    const userId = req.user._id; // Get user from token

    // Verify stream exists and is live
    const stream = await Stream.findById(streamId);
    if (!stream) return res.status(404).json({ message: "Stream not found" });
    if (!stream.isLive)
      return res.status(400).json({ message: "Stream is not live" });

    // Create new chat message
    const newMessage = new LiveMessage({
      streamId,
      sender: userId,
      message,
    });

    await newMessage.save();

    // Add message to stream's chat
    stream.liveChat.push(newMessage._id);
    await stream.save();

    // Populate sender info for response
    await newMessage.populate(
      "sender",
      "username profile.profileImage profile.name",
    );

    // Emit real-time chat message to all stream viewers
    const notificationService = getNotificationService();
    if (notificationService && notificationService.io) {
      notificationService.io
        .to(`stream_${streamId}`)
        .emit("new-stream-message", {
          streamId,
          message: newMessage,
          timestamp: new Date(),
        });
    }

    res.status(201).json(newMessage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get user's streams - requires authentication
export async function getUserStreams(req, res) {
  try {
    const userId = req.user._id;

    const streams = await Stream.find({ host: userId })
      .populate("host", "username profile.profileImage profile.name")
      .sort({ createdAt: -1 });

    res.json(streams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Get stream analytics - only for host
export async function getStreamAnalytics(req, res) {
  try {
    const stream = await Stream.findById(req.params.id).populate(
      "viewers",
      "username profile.profileImage profile.name",
    );

    if (!stream) return res.status(404).json({ message: "Stream not found" });

    // Check if user is the host
    if (stream.host.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the host can view analytics" });
    }

    const analytics = {
      totalViewers: stream.viewers.length,
      totalMessages: stream.liveChat.length,
      duration: stream.endedAt
        ? Math.floor(
            (new Date(stream.endedAt) - new Date(stream.startedAt)) / 1000 / 60,
          )
        : Math.floor((new Date() - new Date(stream.startedAt)) / 1000 / 60),
      isLive: stream.isLive,
      startedAt: stream.startedAt,
      endedAt: stream.endedAt,
    };

    res.json({ stream: stream.title, analytics });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
