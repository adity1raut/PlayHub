import { Pencil, Trash2, UserCheck, UserPlus } from "lucide-react";
import { Button, IconButton, LogoMark } from "../../../components/ui";
import { cn } from "../../../lib/cn";
import { mediaUrl } from "../../../lib/config";

/**
 * Store tile for `grid border-t border-l border-border` grids.
 * - onClick(store): open the store (whole tile is clickable)
 * - onFollow(store): shows a follow toggle; `following` is its state
 * - followersCount: optional live follower total (from `store:followers`); hidden when unknown
 * - showActions + onEdit/onDelete: owner controls
 */
function StoreCard({
  store,
  index,
  showActions = false,
  onEdit,
  onDelete,
  onClick,
  onFollow,
  following = false,
  followLoading = false,
  isOwner = false,
  followersCount,
}) {
  const handleCardClick = () => {
    if (onClick) {
      onClick(store);
    }
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    if (onEdit) {
      onEdit(store);
    }
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    if (onDelete) {
      onDelete(store);
    }
  };

  const handleFollowClick = (e) => {
    e.stopPropagation();
    if (onFollow) {
      onFollow(store);
    }
  };

  const productCount = store.products?.length || 0;
  const since = store.createdAt ? new Date(store.createdAt).getFullYear() : null;
  const ownerName = store.owner?.username || store.owner?.profile?.name;

  return (
    <article
      className={cn(
        "group relative flex flex-col border-r border-b border-border bg-card/60 p-5 transition-colors hover:bg-card",
        onClick && "cursor-pointer",
      )}
    >
      <span aria-hidden="true" className="absolute top-4 right-4 size-5 border-t border-r border-border-strong transition-colors group-hover:border-primary/60" />

      {/* Whole-tile hit area (kept below the action buttons) */}
      {onClick && (
        <button
          type="button"
          onClick={handleCardClick}
          aria-label={`Open ${store.name}`}
          className="absolute inset-0 z-0 outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--primary)]"
        />
      )}

      {index && <p className="text-[10px] text-faint tabular-nums">{index}</p>}

      <div className={cn("flex items-center gap-4", index && "mt-4")}>
        {store.logo ? (
          <img
            src={mediaUrl(store.logo)}
            alt=""
            loading="lazy"
            className="size-14 shrink-0 border border-border object-cover"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center border border-border bg-background/60">
            <LogoMark className="size-7 text-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1 pr-6">
          <h3 className="truncate text-sm font-bold tracking-[0.12em] text-foreground uppercase transition-colors group-hover:text-primary">
            {store.name}
          </h3>
          {ownerName && <p className="mt-1 truncate text-[11px] text-faint">by @{ownerName}</p>}
        </div>
      </div>

      <p
        className={cn(
          "mt-4 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed",
          store.description ? "text-muted-foreground" : "text-faint",
        )}
      >
        {store.description || "No description yet."}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border pt-4">
        <p className="eyebrow text-faint tabular-nums">
          {productCount} {productCount === 1 ? "product" : "products"}
          {typeof followersCount === "number" && (
            <span>
              {" "}
              · {followersCount} {followersCount === 1 ? "follower" : "followers"}
            </span>
          )}
          {since && <span> · since {since}</span>}
        </p>

        {showActions ? (
          <div className="relative z-10 flex items-center gap-1">
            {onEdit && <IconButton icon={Pencil} label="Edit store" size="sm" onClick={handleEditClick} />}
            {onDelete && (
              <IconButton
                icon={Trash2}
                label="Delete store"
                size="sm"
                onClick={handleDeleteClick}
                className="[&_svg]:text-destructive"
              />
            )}
          </div>
        ) : (
          onFollow &&
          !isOwner && (
            <Button
              size="sm"
              variant={following ? "outline" : "default"}
              icon={following ? UserCheck : UserPlus}
              loading={followLoading}
              aria-pressed={following}
              onClick={handleFollowClick}
              className="relative z-10"
            >
              {following ? "Following" : "Follow"}
            </Button>
          )
        )}
      </div>
    </article>
  );
}

export default StoreCard;
