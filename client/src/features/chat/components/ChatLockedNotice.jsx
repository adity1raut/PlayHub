import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Lock, UserPlus } from "lucide-react";
import { API_URL } from "../../../lib/config";
import { toast } from "../../../lib/toast";
import { Button } from "../../../components/ui";
import { idOf } from "../hooks/useChat";

/**
 * Replaces the composer when the two players aren't friends (mutual followers). The history stays
 * readable; following back fires `follow:updated`, and the chat unlocks as soon as it refetches.
 */
const ChatLockedNotice = ({ user, otherUser }) => {
  const [busy, setBusy] = useState(false);
  const otherId = idOf(otherUser);
  const includesOther = (list) => (list || []).some((id) => idOf(id) === otherId);
  const iFollow = includesOther(user?.following);
  const theyFollow = includesOther(user?.followers);
  const handle = otherUser?.username ? `@${otherUser.username}` : "this player";

  const text =
    theyFollow && !iFollow
      ? `${handle} follows you. Follow back to become friends and keep chatting.`
      : iFollow && !theyFollow
        ? `Waiting for ${handle} to follow you back — only friends can message each other.`
        : `You and ${handle} aren't friends. Follow each other to keep chatting.`;

  const follow = async () => {
    setBusy(true);
    try {
      await axios.post(
        `${API_URL}/api/auth/profile/${encodeURIComponent(otherUser.username)}/follow`,
        {},
        { withCredentials: true },
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Couldn't follow");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="status" className="shrink-0 border-t border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-3 border border-dashed border-border-strong px-3 py-2.5">
        <Lock className="size-4 shrink-0 text-faint" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
        {otherUser?.username &&
          (iFollow ? (
            <Button as={Link} to={`/profile/${otherUser.username}`} size="sm" variant="outline">
              View profile
            </Button>
          ) : (
            <Button size="sm" variant="solid" icon={UserPlus} loading={busy} onClick={follow}>
              {theyFollow ? "Follow back" : "Follow"}
            </Button>
          ))}
      </div>
    </div>
  );
};

export default ChatLockedNotice;
