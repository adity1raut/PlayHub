import Stream from "./stream.model.js";
import User from "../auth/user.model.js";
import LiveMessage from "./streamChat.model.js";
import { getNotificationService } from "../../socket/socket.handlers.js";
import { closeRoom } from "../../sfu/index.js";
import { broadcast } from "../../socket/realtime.js";

export async function createStream(req, res) {
  try {
    const { title, description } = req.body;
    const host = req.user._id;

    const hostUser = await User.findById(host).select("_id");
    if (!hostUser) {
      return res.status(404).json({ error: "Host user not found" });
    }

    const streamKey = `${host}-${Date.now()}`;

    const newStream = new Stream({
      host,
      title,
      description,
      streamKey,
      streamUrl: `/live/${streamKey}`,
      isLive: true,
      startedAt: new Date(),
    });

    await newStream.save();
    await User.findByIdAndUpdate(host, { $push: { streams: newStream._id } });

    // Every open streams list shows it right away; followers get their alert when the
    // host's camera/mic actually starts (see announceStreamLive)
    const populated = await Stream.findById(newStream._id)
      .select("-streamKey -liveChat")
      .populate("host", "username profile.name profile.profileImage")
      .lean();
    broadcast("stream:started", { stream: { ...populated, viewers: [] } });

    res.status(201).json(newStream);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

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
        options: { sort: { createdAt: -1 }, limit: 50 },
      });

    if (!stream) return res.status(404).json({ message: "Stream not found" });
    res.json(stream);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function endStream(req, res) {
  try {
    const stream = await Stream.findById(req.params.id).populate(
      "viewers",
      "_id",
    );
    if (!stream) return res.status(404).json({ message: "Stream not found" });

    if (stream.host.toString() !== req.user._id.toString()) {
      return res
        .status(403)
        .json({ message: "Only the host can end the stream" });
    }

    stream.isLive = false;
    stream.endedAt = new Date();
    await stream.save();

    // Stop forwarding video/audio to viewers, and drop it from every live list
    closeRoom(stream._id);
    broadcast("stream:ended", { streamId: String(stream._id), endedAt: stream.endedAt });

    const notificationService = getNotificationService();

    // Tell everyone in the stream room (signed-in or not yet counted as a viewer)
    if (notificationService?.io) {
      notificationService.io.to(`stream_${stream._id}`).emit("stream-ended", {
        streamId: stream._id,
        message: "Stream has ended",
        timestamp: new Date(),
      });
    }

    res.json({ message: "Stream ended", stream });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function joinStream(req, res) {
  try {
    const userId = req.user._id;
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

    }

    res.json({ message: "Joined stream", viewers: stream.viewers.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function leaveStream(req, res) {
  try {
    const userId = req.user._id;
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

export async function sendChatMessage(req, res) {
  try {
    const { message } = req.body;
    const streamId = req.params.id;
    const userId = req.user._id;

    const stream = await Stream.findById(streamId);
    if (!stream) return res.status(404).json({ message: "Stream not found" });
    if (!stream.isLive) {
      return res.status(400).json({ message: "Stream is not live" });
    }

    const newMessage = new LiveMessage({ streamId, sender: userId, message });
    await newMessage.save();

    stream.liveChat.push(newMessage._id);
    await stream.save();

    await newMessage.populate(
      "sender",
      "username profile.profileImage profile.name",
    );

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

export async function getStreamAnalytics(req, res) {
  try {
    const stream = await Stream.findById(req.params.id).populate(
      "viewers",
      "username profile.profileImage profile.name",
    );

    if (!stream) return res.status(404).json({ message: "Stream not found" });

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
            (new Date(stream.endedAt) - new Date(stream.startedAt)) /
              1000 /
              60,
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

/**
 * Tell the host's followers the stream is live — called by the SFU when the host's
 * first camera/mic track starts. Runs at most once per stream.
 */
export async function announceStreamLive(streamId) {
  try {
    const stream = await Stream.findOneAndUpdate(
      { _id: streamId, isLive: true, announcedAt: { $exists: false } },
      { announcedAt: new Date() },
      { new: true },
    );
    if (!stream) return; // already announced or ended

    const hostUser = await User.findById(stream.host).select("username profile.name followers");
    const notificationService = getNotificationService();
    if (!hostUser || !notificationService) return;

    const name = hostUser.profile?.name || hostUser.username;
    for (const followerId of hostUser.followers || []) {
      notificationService
        .createNotification(
          followerId,
          "STREAM_START",
          `${name} is live: ${stream.title}`,
          `/stream/${stream._id}`,
          hostUser._id,
        )
        .catch((error) => console.error("Live notification failed:", error.message));
    }
  } catch (error) {
    console.error("announceStreamLive error:", error.message);
  }
}
