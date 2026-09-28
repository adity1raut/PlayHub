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

/** Send to every socket in a room (e.g. a chat conversation id), or in any of several rooms (each socket once). */
export function toRoom(room, event, payload) {
  if (!room || (Array.isArray(room) && !room.length)) return;
  io?.to(Array.isArray(room) ? room.map(String) : String(room)).emit(event, payload);
}
