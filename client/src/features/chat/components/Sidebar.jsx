import { useMemo } from "react";
import { Search, SquarePen, X } from "lucide-react";
import { IconButton, StatusDot, inputClass } from "../../../components/ui";
import { cn } from "../../../lib/cn";
import ConversationsList from "./ConversationsList";
import SearchSection from "./SearchSection";

const SEARCH_TYPES = [
  { value: "username", label: "Username" },
  { value: "name", label: "Name" },
];

const SectionLabel = ({ children, count }) => (
  <p className="eyebrow flex items-center gap-2 px-4 pt-3 pb-2 text-faint">
    <span className="text-primary">{"//"}</span>
    {children}
    {count != null && <span className="tabular-nums">[{String(count).padStart(2, "0")}]</span>}
  </p>
);

const Sidebar = ({
  className,
  activeView,
  setActiveView,
  conversations,
  searchResults,
  searchQuery,
  setSearchQuery,
  searchType,
  setSearchType,
  loading,
  user,
  openConversation,
  startConversation,
  getOtherUser,
  formatTime,
  currentConversationId,
  typingUsers,
  loadingConversations,
  conversationsError,
  onRetry,
  onNewChat,
  onEndSearch,
  isConnected = true,
  searchInputRef,
}) => {
  const query = searchQuery.trim().replace(/^@/, "").toLowerCase();
  const searching = activeView === "search" || query.length > 0;

  // Local filter of existing threads by the other member's name / username
  const matchingConversations = useMemo(() => {
    if (!query) return [];
    return conversations.filter((conversation) => {
      const other = getOtherUser(conversation);
      return [other?.profile?.name, other?.username].some((v) => v?.toLowerCase().includes(query));
    });
  }, [conversations, query, getOtherUser]);

  const clearSearch = () => {
    if (onEndSearch) onEndSearch();
    else {
      setSearchQuery("");
      setActiveView("conversations");
    }
  };

  return (
    <aside
      aria-label="Conversations"
      className={cn("h-full w-full shrink-0 flex-col border-r border-border bg-sidebar md:w-80", className)}
    >
      <div className="space-y-3 border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow text-faint">Messages</p>
            <h1 className="mt-1 flex items-baseline gap-2 text-base font-extrabold tracking-[0.12em] uppercase">
              Chats
              <span className="text-[11px] font-bold tracking-normal text-faint tabular-nums">
                [{String(conversations.length).padStart(2, "0")}]
              </span>
            </h1>
          </div>
          <IconButton
            icon={SquarePen}
            label="New message"
            size="sm"
            variant="secondary"
            active={activeView === "search"}
            onClick={onNewChat ?? (() => setActiveView("search"))}
          />
        </div>

        {!isConnected && (
          <p role="status" className="eyebrow flex items-center gap-2 text-warning md:hidden">
            <StatusDot tone="danger" pulse />
            Link.Reconnecting
          </p>
        )}

        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint"
          />
          <input
            ref={searchInputRef}
            type="text"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && clearSearch()}
            placeholder={searchType === "username" ? "Search chats or @username" : "Search chats or player name"}
            aria-label="Search conversations and players"
            className={cn(inputClass, "h-9 pr-9 pl-9")}
          />
          {(searchQuery || activeView === "search") && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center text-faint hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div role="radiogroup" aria-label="Search players by" className="grid grid-cols-2 border border-border">
          {SEARCH_TYPES.map(({ value, label }, i) => {
            const active = searchType === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSearchType(value)}
                className={cn(
                  "h-7 text-[10px] font-bold tracking-[0.12em] uppercase transition-colors",
                  i > 0 && "border-l border-border",
                  active
                    ? "bg-primary/10 text-primary shadow-[inset_0_-2px_0_var(--primary)]"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-2 scrollbar-thin">
        {searching ? (
          <>
            {matchingConversations.length > 0 && (
              <section aria-label="Matching conversations">
                <SectionLabel count={matchingConversations.length}>Conversations</SectionLabel>
                <ConversationsList
                  conversations={matchingConversations}
                  user={user}
                  openConversation={openConversation}
                  getOtherUser={getOtherUser}
                  formatTime={formatTime}
                  currentConversationId={currentConversationId}
                  typingUsers={typingUsers}
                />
              </section>
            )}
            <SearchSection
              searchQuery={searchQuery}
              searchType={searchType}
              searchResults={searchResults}
              loading={loading}
              startConversation={startConversation}
              label={<SectionLabel count={query.length >= 2 && !loading ? searchResults.length : null}>Players</SectionLabel>}
            />
          </>
        ) : (
          <section aria-label="All conversations" className="pt-2">
            <ConversationsList
              conversations={conversations}
              user={user}
              openConversation={openConversation}
              getOtherUser={getOtherUser}
              formatTime={formatTime}
              currentConversationId={currentConversationId}
              typingUsers={typingUsers}
              loading={loadingConversations}
              error={conversationsError}
              onRetry={onRetry}
              onNewChat={onNewChat}
            />
          </section>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
