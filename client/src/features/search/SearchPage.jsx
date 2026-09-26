import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { AtSign, MessageSquare, Newspaper, Search, SearchX, UserRound, Users, X } from "lucide-react";
import PostCard from "../posts/PostCard";
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardBar,
  EmptyState,
  IconButton,
  Input,
  LoadingBlock,
  Page,
  PageHeader,
  Tabs,
} from "../../components/ui";
import { API_URL as backendUrl } from "../../lib/config";

const DEBOUNCE_MS = 400;
const MIN_PEOPLE_QUERY = 2; // backend rejects shorter user searches

const SearchPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("tab") === "posts" ? "posts" : "people");
  const [peopleType, setPeopleType] = useState("username");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [people, setPeople] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(0);
  const inputRef = useRef(null);

  const term = query.trim();
  const minLength = tab === "people" ? MIN_PEOPLE_QUERY : 1;
  const tooShort = term.length > 0 && term.length < minLength;

  const runSearch = async (q, which, type) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      if (which === "people") {
        // GET /api/chat/search?query&type → { success, users: [{ _id, username, profile: { name, profileImage } }] }
        const res = await axios.get(`${backendUrl}/api/chat/search`, {
          params: { query: q, type },
          withCredentials: true,
        });
        if (id !== requestId.current) return;
        setPeople(res.data.success ? (res.data.users ?? []) : []);
      } else {
        // GET /api/posts/search/:query → { success, posts }
        const res = await axios.get(`${backendUrl}/api/posts/search/${encodeURIComponent(q)}`, {
          withCredentials: true,
        });
        if (id !== requestId.current) return;
        setResults(res.data.success ? (res.data.posts ?? []) : []);
      }
      setHasSearched(true);
    } catch (err) {
      if (id !== requestId.current) return;
      console.error(`Error searching ${which}:`, err);
      setError(err.response?.data?.message || "Search failed. Please try again.");
      if (which === "people") setPeople([]);
      else setResults([]);
      setHasSearched(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  // Debounced search as you type; also re-runs when switching tab / match type
  useEffect(() => {
    if (term.length < minLength) {
      requestId.current += 1; // drop any in-flight response
      setLoading(false);
      setHasSearched(false);
      setError(null);
      return undefined;
    }
    setLoading(true);
    const t = setTimeout(() => runSearch(term, tab, peopleType), DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, tab, peopleType]);

  // Keep ?q=&tab= in the URL so searches can be shared / restored
  useEffect(() => {
    const next = {};
    if (term) next.q = term;
    if (tab === "posts") next.tab = "posts";
    setParams(next, { replace: true });
  }, [term, tab, setParams]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (term.length < minLength) return;
    runSearch(term, tab, peopleType);
  };

  const clear = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const handleDeletePost = (postId) => setResults((p) => p.filter((post) => post._id !== postId));

  const count = hasSearched && !loading ? (tab === "people" ? people.length : results.length) : null;

  const renderPeople = () => {
    if (people.length === 0) {
      return (
        <EmptyState
          icon={SearchX}
          title="No players found"
          description={
            peopleType === "name"
              ? "Nobody matches that name. Try searching by username instead."
              : "No usernames match. Check the spelling or try a shorter search."
          }
        />
      );
    }
    return (
      <ul className="divide-y divide-border">
        {people.map((u) => {
          const name = u.profile?.name || u.username;
          return (
            <li key={u._id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent sm:px-5">
              <Link to={`/profile/${encodeURIComponent(u.username)}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar src={u.profile?.profileImage} name={name} size="md" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-foreground">{name}</span>
                  <span className="block truncate text-[11px] text-faint">@{u.username}</span>
                </span>
              </Link>
              <Button
                variant="outline"
                size="sm"
                icon={MessageSquare}
                aria-label={`Message ${u.username}`}
                onClick={() => navigate("/chat", { state: { startChatWith: u } })}
              >
                <span className="hidden sm:inline">Message</span>
              </Button>
            </li>
          );
        })}
      </ul>
    );
  };

  const renderPosts = () => {
    if (results.length === 0) {
      return (
        <Card>
          <EmptyState
            icon={SearchX}
            title="No posts found"
            description="No posts match your search. Try different keywords or hashtags."
          />
        </Card>
      );
    }
    return (
      <div className="max-w-3xl space-y-4">
        {results.map((post) => (
          <PostCard key={post._id} post={post} onDelete={handleDeletePost} />
        ))}
      </div>
    );
  };

  const idle = (
    <Card>
      <EmptyState
        icon={tab === "people" ? Users : Newspaper}
        title={tab === "people" ? "Find players" : "Search posts"}
        description={
          tooShort
            ? `Type at least ${minLength} characters to search.`
            : tab === "people"
              ? "Search by username or display name, then open their profile or start a chat."
              : "Enter keywords or hashtags to find posts from the community."
        }
      />
    </Card>
  );

  return (
    <Page>
      <PageHeader
        eyebrow="Workspace / Search"
        title="Search"
        description="Find players to follow and message, or dig through community posts."
      />

      <form onSubmit={handleSearch} className="space-y-3" role="search">
        <Input
          ref={inputRef}
          icon={Search}
          type="text"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === "people" ? "Search players…" : "Search posts, hashtags…"}
          aria-label={tab === "people" ? "Search players" : "Search posts"}
          autoFocus
          inputClassName="h-12 text-sm"
          trailing={query ? <IconButton icon={X} label="Clear search" size="sm" onClick={clear} /> : null}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            options={[
              { value: "people", label: "People", icon: Users, count: tab === "people" ? (count ?? undefined) : undefined },
              { value: "posts", label: "Posts", icon: Newspaper, count: tab === "posts" ? (count ?? undefined) : undefined },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === "people" && (
            <div className="flex items-center gap-3">
              <span className="eyebrow hidden text-faint sm:inline">Match</span>
              <Tabs
                options={[
                  { value: "username", label: "Username", icon: AtSign },
                  { value: "name", label: "Name", icon: UserRound },
                ]}
                value={peopleType}
                onChange={setPeopleType}
              />
            </div>
          )}
        </div>
      </form>

      <section aria-live="polite" aria-busy={loading}>
        {error && (
          <Alert variant="destructive" className="mb-4">
            {error}
          </Alert>
        )}
        {loading ? (
          <Card>
            <LoadingBlock label={tab === "people" ? "Searching players" : "Searching posts"} />
          </Card>
        ) : !hasSearched ? (
          idle
        ) : tab === "people" ? (
          <Card>
            <CardBar
              title="Players"
              right={
                <span className="text-[11px] text-faint tabular-nums">
                  {people.length} result{people.length === 1 ? "" : "s"}
                </span>
              }
            />
            {renderPeople()}
          </Card>
        ) : (
          <>
            {results.length > 0 && (
              <p className="eyebrow mb-3 text-faint">
                {results.length} post{results.length === 1 ? "" : "s"} matching “{term}”
              </p>
            )}
            {renderPosts()}
          </>
        )}
      </section>
    </Page>
  );
};

export default SearchPage;
