// End-to-end: live-stream signaling (SFU room, viewers, ICE restart, quality) and the stream
// socket API (chat with moderation, reactions, live stats). No real media is sent — mediasoup
// runs for real, but these tests stop at the signaling layer.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createHarness, sleep } from "./harness.js";

const h = createHarness("stream");
const { skip } = h;

/** emit with an acknowledgement as a connected label */
const ask = (label, event, data) => h.sockets[label].timeout(5000).emitWithAck(event, data);

let streamId;

before(async () => {
  await h.start({ users: ["alice", "bob", "carol"] });
  if (skip) return;
  await h.connect("bob", "bob2"); // a second tab of bob
  const created = await h.api("alice", "POST", "/api/stream/create", { title: "Ranked night" });
  streamId = created._id;
  for (const label of ["alice", "bob", "bob2", "carol"]) h.sockets[label].emit("join-stream", streamId);
  await sleep(200);
});

after(() => h.stop());

test("SFU room: viewers counted per person (not per tab, never the host), peak + watch history kept", { skip }, async () => {
  h.clear();
  const hostJoin = await ask("alice", "sfu:join", { streamId });
  assert.equal(hostJoin.isHost, true);
  assert.ok(hostJoin.rtpCapabilities?.codecs?.length, "router capabilities come back");

  for (const label of ["bob", "bob2", "carol"]) {
    const res = await ask(label, "sfu:join", { streamId });
    assert.equal(res.isHost, false);
  }
  const last = (await h.waitFor("alice", "sfu:viewers", (p) => p.count === 2)).viewers;
  assert.deepEqual(last.map((v) => v.username).sort(), ["bob", "carol"]);
  assert.ok(!("email" in last[0]), "only public profile fields");

  // bob closes one tab: still watching
  await ask("bob2", "sfu:leave", { streamId });
  await sleep(200);
  assert.equal(h.seen("alice", "sfu:viewers").at(-1).payload.count, 2);

  const stats = await h.waitFor("alice", "stream:stats", (s) => s.viewers === 2 && s.peakViewers === 2, 4000);
  assert.equal(stats.uniqueViewers, 2);

  const stream = await h.api("carol", "GET", `/api/stream/${streamId}`);
  assert.ok(!("streamKey" in stream), "stream key never leaks");
  assert.equal(stream.liveViewers, 2);
  assert.equal(stream.messagesCount, 0);
});

test("SFU: ICE restart gives new credentials; quality needs a real consumer", { skip }, async () => {
  const transport = await ask("bob", "sfu:create-transport", { streamId, direction: "recv" });
  assert.ok(transport.id);
  const restarted = await ask("bob", "sfu:restart-ice", { streamId, transportId: transport.id });
  assert.ok(restarted.iceParameters?.usernameFragment);
  assert.notEqual(restarted.iceParameters.usernameFragment, transport.iceParameters.usernameFragment);

  const noConsumer = await ask("bob", "sfu:set-quality", { streamId, consumerId: "nope", quality: "low" });
  assert.match(noConsumer.error, /consumer not found/i);
  const sendAsViewer = await ask("bob", "sfu:create-transport", { streamId, direction: "send" });
  assert.match(sendAsViewer.error, /only the host/i);
});

test("chat: acknowledged sends, length limit, and who may delete what", { skip }, async () => {
  h.clear();
  const sent = await ask("bob", "send-stream-message", { streamId, message: "  gg  " });
  assert.equal(sent.message?.message, "gg");
  await h.waitFor("carol", "new-stream-message", (p) => p.message?._id === sent.message._id);

  assert.match((await ask("bob", "send-stream-message", { streamId, message: "x".repeat(501) })).error, /500/);
  assert.match((await ask("bob", "send-stream-message", { streamId, message: "   " })).error, /empty/i);

  const byCarol = await ask("carol", "send-stream-message", { streamId, message: "hi" });
  const notYours = await ask("bob", "stream-chat:delete", { streamId, messageId: byCarol.message._id });
  assert.match(notYours.error, /only the host/i);
  assert.equal((await ask("bob", "stream-chat:delete", { streamId, messageId: sent.message._id })).ok, true);
  assert.equal((await ask("alice", "stream-chat:delete", { streamId, messageId: byCarol.message._id })).ok, true);
  await h.waitFor("carol", "stream-chat:deleted", (p) => p.messageId === byCarol.message._id);

  const stream = await h.api("carol", "GET", `/api/stream/${streamId}`);
  assert.equal(stream.messagesCount, 0, "deleted messages are gone for good");
});

test("chat: host mutes (socket + REST enforced) and slow mode", { skip }, async () => {
  h.clear();
  assert.match((await ask("bob", "stream-chat:mute", { streamId, userId: String(h.users.carol._id), minutes: 5 })).error, /only the host/i);
  assert.match((await ask("alice", "stream-chat:mute", { streamId, userId: String(h.users.bob._id), minutes: 7 })).error, /1, 5, 10 or 60/);

  const muted = await ask("alice", "stream-chat:mute", { streamId, userId: String(h.users.bob._id), minutes: 1 });
  assert.ok(muted.until);
  await h.waitFor("bob", "stream-chat:muted", (p) => p.userId === String(h.users.bob._id) && p.until);

  const refused = await ask("bob", "send-stream-message", { streamId, message: "let me talk" });
  assert.equal(refused.code, "CHAT_MUTED");
  const viaRest = await h.api("bob", "POST", `/api/stream/${streamId}/chat`, { message: "rest?" });
  assert.equal(viaRest.code, "CHAT_MUTED");
  const listed = await h.api("carol", "GET", `/api/stream/${streamId}`);
  assert.equal(listed.chatMutes.length, 1);

  await ask("alice", "stream-chat:mute", { streamId, userId: String(h.users.bob._id), minutes: 0 });
  assert.ok((await ask("bob", "send-stream-message", { streamId, message: "thanks" })).message);

  // Slow mode: one message per 5s for viewers; the host is exempt
  assert.match((await ask("alice", "stream:set-slow-mode", { streamId, seconds: 7 })).error, /5, 15, 30 or 60/);
  await ask("alice", "stream:set-slow-mode", { streamId, seconds: 5 });
  await h.waitFor("carol", "stream:chat-settings", (p) => p.chatSlowMode === 5);
  assert.ok((await ask("carol", "send-stream-message", { streamId, message: "one" })).message);
  const tooFast = await ask("carol", "send-stream-message", { streamId, message: "two" });
  assert.equal(tooFast.code, "CHAT_SLOW");
  assert.ok(tooFast.retryIn > 0);
  assert.ok((await ask("alice", "send-stream-message", { streamId, message: "host 1" })).message);
  assert.ok((await ask("alice", "send-stream-message", { streamId, message: "host 2" })).message);
  await ask("alice", "stream:set-slow-mode", { streamId, seconds: 0 });
});

test("reactions: broadcast to the room, validated, rate-limited, counted", { skip }, async () => {
  h.clear();
  assert.equal((await ask("bob", "stream:react", { streamId, emoji: "🔥" })).ok, true);
  await h.waitFor("carol", "stream:reaction", (p) => p.emoji === "🔥");
  assert.match((await ask("bob", "stream:react", { streamId, emoji: "💩" })).error, /unknown reaction/i);

  const burst = await Promise.all(Array.from({ length: 12 }, () => ask("carol", "stream:react", { streamId, emoji: "❤️" })));
  const accepted = burst.filter((r) => r.ok).length;
  assert.ok(accepted >= 6 && accepted < 12, `burst allowed ${accepted} of 12`);

  const stats = await h.waitFor("alice", "stream:stats", (s) => s.reactions === accepted + 1, 4000);
  assert.equal(stats.reactions, accepted + 1);
});

test("stage: viewers ask, the host lets them in or not; only guests on stage may share", { skip }, async () => {
  h.clear();
  const bobId = String(h.users.bob._id);
  const carolId = String(h.users.carol._id);
  const state = await ask("bob", "stage:state", { streamId });
  assert.equal(state.status, "none");
  assert.deepEqual(state.guests, []);
  assert.ok(!("requests" in state), "only the host sees the waiting list");

  const early = await ask("bob", "sfu:create-transport", { streamId, direction: "send" });
  assert.match(early.error, /host and guests on stage/i);

  const pending = await ask("bob", "stage:request", { streamId });
  assert.equal(pending.status, "pending");
  const waiting = await h.waitFor("alice", "stage:requests", (p) => p.requests.some((r) => r.username === "bob"));
  assert.ok(!("email" in waiting.requests[0]));
  await ask("carol", "stage:request", { streamId });
  assert.match((await ask("carol", "stage:respond", { streamId, userId: bobId, approve: true })).error, /only the host/i);

  // No for carol: she hears back and has to wait before asking again
  await ask("alice", "stage:respond", { streamId, userId: carolId, approve: false });
  await h.waitFor("carol", "stage:status", (p) => p.status === "none" && p.reason === "denied");
  assert.match((await ask("carol", "stage:request", { streamId })).error, /ask again in \d+s/);

  // Yes for bob: everyone sees him on stage, and he may now open a send transport
  const hostView = await ask("alice", "stage:respond", { streamId, userId: bobId, approve: true });
  assert.deepEqual(hostView.requests, []);
  await h.waitFor("bob", "stage:status", (p) => p.status === "approved");
  await h.waitFor("carol", "stage:guests", (p) => p.guests.map((g) => g.username).join() === "bob");
  const send = await ask("bob", "sfu:create-transport", { streamId, direction: "send" });
  assert.ok(send.id, send.error);
  const camera = await ask("bob", "sfu:produce", {
    streamId,
    transportId: send.id,
    kind: "video",
    rtpParameters: {},
    appData: { source: "camera" },
  });
  assert.match(camera.error, /mic and screen/i, "guests share screen + mic, not a camera");

  // Host takes him off stage → sharing is closed to him again
  await ask("alice", "stage:remove", { streamId, userId: bobId });
  await h.waitFor("bob", "stage:status", (p) => p.status === "none" && p.reason === "removed");
  assert.match((await ask("bob", "sfu:create-transport", { streamId, direction: "send" })).error, /host and guests/i);

  // A guest can also step down by themselves
  await ask("bob", "stage:request", { streamId });
  await ask("alice", "stage:respond", { streamId, userId: bobId, approve: true });
  await ask("bob", "stage:leave", { streamId });
  await h.waitFor("bob", "stage:status", (p) => p.reason === "left");
  const joined = await ask("bob", "sfu:join", { streamId });
  assert.equal(joined.userId, bobId);
  assert.equal(joined.stage.status, "none");
});

test("ending: the room closes, chat and reactions stop, analytics keep the totals", { skip }, async () => {
  h.clear();
  await h.api("alice", "PUT", `/api/stream/${streamId}/end`);
  await h.waitFor("bob", "sfu:room-closed", (p) => p.streamId === streamId);
  await h.waitFor("carol", "stream:ended", (p) => p.streamId === streamId);

  assert.match((await ask("bob", "send-stream-message", { streamId, message: "late" })).error, /ended/i);
  assert.match((await ask("bob", "stream:react", { streamId, emoji: "👏" })).error, /ended/i);

  const { analytics } = await h.api("alice", "GET", `/api/stream/${streamId}/analytics`);
  assert.equal(analytics.isLive, false);
  assert.equal(analytics.peakViewers, 2);
  assert.equal(analytics.totalViewers, 2, "bob (two tabs) and carol");
  assert.ok(analytics.totalReactions >= 7);
});
