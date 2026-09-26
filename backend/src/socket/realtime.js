/**
 * Server → client realtime updates (see README "Realtime events").
 * Controllers call these after a change is saved so every open page updates live.
 */
let io = null;

export function setRealtimeServer(server) {
  io = server;
}

/** Send to every connected client. */
export function broadcast(event, payload) {
  io?.emit(event, payload);
}

/** Send to all of one user's open tabs/devices. */
export function toUser(userId, event, payload) {
  if (userId) io?.to(`user_${userId}`).emit(event, payload);
}
