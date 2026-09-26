import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, FileX } from "lucide-react";
import { API_URL } from "../../lib/config";
import { useSocketEvent } from "../../lib/useSocketEvent";
import { Button, EmptyState, LoadingBlock, Page, PageHeader } from "../../components/ui";
import PostCard from "./PostCard";

/** /post/:postId — one post with its comments (target of notification + share links). */
export default function SinglePost() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    axios
      .get(`${API_URL}/api/posts/${postId}`)
      .then(({ data }) => {
        if (cancelled) return;
        setPost(data.post);
        setStatus(data.post ? "ready" : "missing");
      })
      .catch(() => !cancelled && setStatus("missing"));
    return () => {
      cancelled = true;
    };
  }, [postId]);

  // Realtime: deleted elsewhere → show the not-found state. (Like / comment counts are
  // kept live by PostCard itself.)
  useSocketEvent("post:deleted", ({ postId: deletedId } = {}) => {
    if (deletedId && String(deletedId) === String(postId)) {
      setPost(null);
      setStatus("missing");
    }
  });

  return (
    <Page className="max-w-3xl">
      <PageHeader
        eyebrow="Community / Post"
        title="Post"
        actions={
          <Button as={Link} to="/post" variant="ghost" size="sm" icon={ArrowLeft}>
            Back to feed
          </Button>
        }
      />
      {status === "loading" && <LoadingBlock label="Loading post" />}
      {status === "missing" && (
        <EmptyState
          icon={FileX}
          title="Post not found"
          description="It may have been deleted, or the link is wrong."
          action={
            <Button as={Link} to="/post">
              Open feed
            </Button>
          }
        />
      )}
      {status === "ready" && post && (
        <PostCard post={post} onUpdate={setPost} onDelete={() => navigate("/post", { replace: true })} />
      )}
    </Page>
  );
}
