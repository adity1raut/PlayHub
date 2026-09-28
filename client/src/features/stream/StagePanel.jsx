import { Check, Hand, Hourglass, LogOut, Mic, MicOff, MonitorOff, MonitorUp, UserMinus, X } from "lucide-react";
import { Alert, Avatar, Button, Card, CardBar, IconButton } from "../../components/ui";
import { cn } from "../../lib/cn";
import { screenShareSupported } from "../../lib/sfu";

const nameOf = (user) => user?.name || user?.username || "Guest";

/** Mic / screen state for one person on stage. */
function MediaState({ mic, screen }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-faint">
      {mic ? (
        <Mic className="size-3.5 text-primary" aria-label="Mic on" />
      ) : (
        <MicOff className="size-3.5" aria-label="Mic off" />
      )}
      {screen ? (
        <MonitorUp className="size-3.5 text-primary" aria-label="Sharing screen" />
      ) : (
        <MonitorOff className="size-3.5" aria-label="Not sharing" />
      )}
    </span>
  );
}

function Person({ user, label, speaking, children }) {
  return (
    <li className="flex items-center gap-3 px-5 py-2.5">
      <span className={cn("rounded-none", speaking && "ring-2 ring-primary")}>
        <Avatar src={user?.profileImage} name={nameOf(user)} size="sm" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-bold text-foreground">{label ?? nameOf(user)}</span>
        <span className="block truncate text-[11px] text-faint">@{user?.username}</span>
      </span>
      {children}
    </li>
  );
}

/**
 * The stream's stage: up to `maxGuests` viewers the host lets in share their screen and mic with
 * everyone. `media` maps userId → { mic, screen } for what each guest is sharing right now;
 * `guestMedia` (useGuestMedia) holds the viewer's own mic/screen once they're on stage.
 */
export default function StagePanel({ stage, isHost, hostUsername, selfId, media = {}, speakerId, guestMedia, ready = true }) {
  const onStage = stage.status === "approved";
  const speaking = (userId) => speakerId && String(speakerId) === String(userId);

  return (
    <Card as="section" aria-labelledby="stage-title">
      <CardBar
        title={<span id="stage-title">Stage</span>}
        right={
          <span className="text-[11px] text-faint tabular-nums">
            {stage.guests.length}/{stage.maxGuests} guests
          </span>
        }
      />

      {!isHost && stage.status === "none" && (
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Share your screen and mic with everyone watching. @{hostUsername} decides who joins.
          </p>
          <Button
            size="sm"
            variant="solid"
            icon={Hand}
            className="shrink-0"
            loading={stage.busy === "request"}
            disabled={!ready || stage.isFull}
            onClick={stage.request}
          >
            {stage.isFull ? "Stage is full" : "Ask to join"}
          </Button>
        </div>
      )}

      {!isHost && stage.status === "pending" && (
        <div className="flex items-center justify-between gap-3 px-5 py-4" role="status">
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Hourglass className="size-3.5 text-primary" aria-hidden="true" />
            Waiting for @{hostUsername} to let you in…
          </p>
          <Button size="sm" variant="ghost" loading={stage.busy === "cancel"} onClick={stage.cancel}>
            Cancel
          </Button>
        </div>
      )}

      {!isHost && onStage && guestMedia && (
        <div className="space-y-3 border-b border-border px-5 py-4">
          <p className="text-[11px] text-muted-foreground">
            <span className="font-bold text-primary">You&apos;re on stage.</span> Your browser asks before sharing
            anything.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={guestMedia.micOn ? "default" : "outline"}
              icon={guestMedia.micOn ? Mic : MicOff}
              aria-pressed={guestMedia.micOn}
              loading={guestMedia.busy === "mic"}
              onClick={guestMedia.toggleMic}
            >
              {guestMedia.micOn ? "Mic on" : "Turn on mic"}
            </Button>
            {screenShareSupported() && (
              <Button
                size="sm"
                variant={guestMedia.screenOn ? "default" : "outline"}
                icon={guestMedia.screenOn ? MonitorOff : MonitorUp}
                aria-pressed={guestMedia.screenOn}
                loading={guestMedia.busy === "screen"}
                onClick={guestMedia.toggleScreen}
              >
                {guestMedia.screenOn ? "Stop sharing" : "Share screen"}
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              icon={LogOut}
              className="ml-auto"
              loading={stage.busy === "leave"}
              onClick={stage.leave}
            >
              Leave stage
            </Button>
          </div>
          {guestMedia.error && (
            <Alert variant="destructive">
              <span className="flex items-start justify-between gap-3">
                {guestMedia.error}
                <button type="button" className="shrink-0 underline" onClick={guestMedia.clearError}>
                  Dismiss
                </button>
              </span>
            </Alert>
          )}
        </div>
      )}

      {isHost && stage.requests.length > 0 && (
        <div className="border-b border-border">
          <p className="eyebrow px-5 pt-3 text-faint">Waiting to join · {stage.requests.length}</p>
          <ul>
            {stage.requests.map((r) => (
              <Person key={r._id} user={r}>
                <Button
                  size="sm"
                  variant="solid"
                  icon={Check}
                  loading={stage.busy === `respond:${r._id}`}
                  disabled={stage.isFull}
                  title={stage.isFull ? "The stage is full — remove a guest first" : undefined}
                  onClick={() => stage.respond(r._id, true)}
                >
                  Let in
                </Button>
                <IconButton icon={X} label={`Not now for @${r.username}`} size="sm" onClick={() => stage.respond(r._id, false)} />
              </Person>
            ))}
          </ul>
        </div>
      )}

      {stage.guests.length > 0 ? (
        <ul className="py-1">
          {stage.guests.map((g) => {
            const mine = String(g._id) === String(selfId);
            const now = mine && guestMedia ? { mic: guestMedia.micOn, screen: guestMedia.screenOn } : media[g._id] || {};
            return (
              <Person key={g._id} user={g} label={mine ? "You" : undefined} speaking={speaking(g._id)}>
                <MediaState mic={now.mic} screen={now.screen} />
                {isHost && (
                  <IconButton
                    icon={UserMinus}
                    label={`Remove @${g.username} from the stage`}
                    size="sm"
                    onClick={() => stage.remove(g._id)}
                  />
                )}
              </Person>
            );
          })}
        </ul>
      ) : (
        (isHost || stage.status !== "none") && (
          <p className="px-5 py-4 text-[11px] text-faint">
            <span className="text-primary">&gt;</span>{" "}
            {isHost ? "Viewers can ask to join. You'll get a notification when someone does." : "Nobody else is on stage yet."}
          </p>
        )
      )}
    </Card>
  );
}
