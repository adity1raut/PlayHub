import os from "os";

// First non-internal IPv4 address — lets phones on the same Wi-Fi reach the SFU,
// and still works from the machine itself.
function detectLanIp() {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const a of addresses || []) {
      if (a.family === "IPv4" && !a.internal) return a.address;
    }
  }
  return "127.0.0.1";
}

export const sfuConfig = {
  // One UDP+TCP port carries all WebRTC media (open it in the firewall in production)
  port: Number(process.env.SFU_PORT) || 44444,
  listenIp: process.env.SFU_LISTEN_IP || "0.0.0.0",
  // The address browsers connect to: public IP in production, LAN IP / 127.0.0.1 locally
  announcedIp: process.env.SFU_ANNOUNCED_IP || detectLanIp(),

  mediaCodecs: [
    { kind: "audio", mimeType: "audio/opus", clockRate: 48000, channels: 2 },
    {
      kind: "video",
      mimeType: "video/VP8",
      clockRate: 90000,
      parameters: { "x-google-start-bitrate": 1000 },
    },
    {
      kind: "video",
      mimeType: "video/H264",
      clockRate: 90000,
      parameters: {
        "packetization-mode": 1,
        "profile-level-id": "42e01f",
        "level-asymmetry-allowed": 1,
        "x-google-start-bitrate": 1000,
      },
    },
  ],

  maxIncomingBitrate: 3_000_000, // host upload cap per transport
  initialOutgoingBitrate: 1_000_000,
};
