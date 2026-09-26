import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Avatar, Spinner } from "../../../components/ui";

/** Player search results (GET /api/chat/search). The input + type toggle live in the Sidebar header. */
const SearchSection = ({ searchQuery, searchType, searchResults, loading, startConversation, label }) => {
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

  return (
    <section aria-label="Players" aria-busy={loading || undefined}>
      {label}
      {query.length < 2 ? (
        <p className="px-4 py-6 text-center text-xs leading-relaxed text-faint">
          <span className="text-primary">&gt;</span> Type at least 2 characters to find a player by{" "}
          {searchType === "username" ? "username" : "name"}.
        </p>
      ) : loading ? (
        <div className="flex justify-center py-8">
          <Spinner label="Searching players" />
        </div>
      ) : searchResults.length > 0 ? (
        <ul>
          {searchResults.map((user) => {
            const name = user.profile?.name || user.username;
            const busy = startingId === user._id;
            return (
              <li key={user._id}>
                <button
                  type="button"
                  onClick={() => start(user._id)}
                  disabled={Boolean(startingId)}
                  aria-busy={busy || undefined}
                  className="group flex w-full items-center gap-3 border-l-2 border-transparent px-4 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-accent disabled:opacity-60"
                >
                  <Avatar src={user.profile?.profileImage} name={name} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold text-foreground">{name}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">@{user.username}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold tracking-[0.12em] text-faint uppercase group-hover:text-foreground">
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin text-primary" aria-hidden="true" />
                    ) : (
                      <span className="text-primary">&gt;</span>
                    )}
                    Chat
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-6 text-center text-xs text-faint">No players match “{query}”.</p>
      )}
    </section>
  );
};

export default SearchSection;
