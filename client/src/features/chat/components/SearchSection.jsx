import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { Avatar, Badge, Spinner } from "../../../components/ui";

const rowClass =
  "group flex w-full items-center gap-3 border-l-2 border-transparent px-4 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-accent disabled:opacity-60";
const actionClass =
  "flex shrink-0 items-center gap-1 text-[10px] font-bold tracking-[0.12em] text-faint uppercase group-hover:text-foreground";

/** One player: starts a chat when allowed, otherwise links to their profile to follow them. */
const PlayerRow = ({ player, busy, disabled, onStart }) => {
  const name = player.profile?.name || player.username;
  const identity = (
    <>
      <Avatar src={player.profile?.profileImage} name={name} size="md" />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-bold text-foreground">{name}</span>
          {player.isFriend && <Badge variant="success">Friend</Badge>}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">@{player.username}</span>
      </span>
    </>
  );

  if (player.canMessage === false) {
    return (
      <Link to={`/profile/${player.username}`} className={rowClass} title="Only friends can chat — open their profile to follow">
        {identity}
        <span className={actionClass}>
          <Lock className="size-3" aria-hidden="true" />
          Follow to chat
        </span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onStart} disabled={disabled} aria-busy={busy || undefined} className={rowClass}>
      {identity}
      <span className={actionClass}>
        {busy ? (
          <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
        ) : (
          <span className="text-primary">&gt;</span>
        )}
        Chat
      </span>
    </button>
  );
};

/**
 * Player search results (GET /api/chat/search). The input + type toggle live in the Sidebar header.
 * Before 2 characters are typed it lists your friends (GET /api/chat/friends) to start a chat with.
 */
const SearchSection = ({
  searchQuery,
  searchType,
  searchResults,
  loading,
  startConversation,
  label,
  friends = [],
  friendsLoading = false,
  friendsLabel,
}) => {
  const [startingId, setStartingId] = useState(null);
  const query = searchQuery.trim().replace(/^@/, "");

  const start = async (userId) => {
    if (startingId) return;
    setStartingId(userId);
    try {
      await startConversation(userId);
    } finally {
      setStartingId(null);
    }
  };

  const renderList = (players) => (
    <ul>
      {players.map((player) => (
        <li key={player._id}>
          <PlayerRow
            player={player}
            busy={startingId === player._id}
            disabled={Boolean(startingId)}
            onStart={() => start(player._id)}
          />
        </li>
      ))}
    </ul>
  );

  if (query.length < 2) {
    return (
      <section aria-label="Friends" aria-busy={friendsLoading || undefined}>
        {friendsLabel}
        {friendsLoading ? (
          <div className="flex justify-center py-8">
            <Spinner label="Loading friends" />
          </div>
        ) : friends.length > 0 ? (
          renderList(friends)
        ) : (
          <p className="px-4 py-4 text-xs leading-relaxed text-faint">
            <span className="text-primary">&gt;</span> No friends yet. Friends are players who follow each other — find
            someone below and follow them.
          </p>
        )}
        <p className="px-4 pt-3 pb-6 text-center text-xs leading-relaxed text-faint">
          <span className="text-primary">&gt;</span> Type at least 2 characters to find a player by{" "}
          {searchType === "username" ? "username" : "name"}.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Players" aria-busy={loading || undefined}>
      {label}
      {loading ? (
        <div className="flex justify-center py-8">
          <Spinner label="Searching players" />
        </div>
      ) : searchResults.length > 0 ? (
        renderList(searchResults)
      ) : (
        <p className="px-4 py-6 text-center text-xs text-faint">No players match “{query}”.</p>
      )}
    </section>
  );
};

export default SearchSection;
