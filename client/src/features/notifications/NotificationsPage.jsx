import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCheck, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useNotifications } from "../../context/NotificationContext";
import NotificationItem from "./NotificationItem";
import DeviceAlertsCard from "./DeviceAlertsCard";
import { Button, Card, CardBar, EmptyState, IconButton, LoadingBlock, Page, PageHeader, Spinner, Tabs } from "../../components/ui";

function NotificationsPage() {
  const {
    notifications,
    loading,
    pagination,
    fetchNotifications,
    markAllAsRead,
    unreadCount,
  } = useNotifications();
  const [filter, setFilter] = useState("all");
  const [marking, setMarking] = useState(false);

  const limit = pagination?.limit || 20;
  const page = pagination?.page || 1;
  const totalPages = pagination?.totalPages || 0;
  const totalCount = Math.max(pagination?.totalCount || 0, notifications.length);

  // Refresh when the page opens so the list is current (live ones arrive over the socket)
  useEffect(() => {
    fetchNotifications(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchNotifications]);

  const handlePageChange = (newPage) => {
    fetchNotifications(newPage, limit);
  };

  const handleMarkAll = async () => {
    setMarking(true);
    await markAllAsRead();
    setMarking(false);
  };

  const visible = filter === "unread" ? notifications.filter((n) => !n.isRead) : notifications;
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, pagination?.totalCount || notifications.length);

  return (
    <Page>
      <PageHeader
        eyebrow="Workspace / Alerts"
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread ${unreadCount === 1 ? "notification" : "notifications"}.`
            : "You're all caught up."
        }
        actions={
          <Button icon={CheckCheck} onClick={handleMarkAll} loading={marking} disabled={unreadCount === 0}>
            Mark all read
          </Button>
        }
      />

      <DeviceAlertsCard />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          options={[
            { value: "all", label: "All", icon: Bell, count: totalCount },
            { value: "unread", label: "Unread", count: unreadCount },
          ]}
          value={filter}
          onChange={setFilter}
        />
        <IconButton
          icon={RefreshCw}
          label="Refresh notifications"
          variant="outline"
          onClick={() => fetchNotifications(page, limit)}
          disabled={loading}
          className={loading ? "[&_svg]:animate-spin" : undefined}
        />
      </div>

      <Card>
        <CardBar
          title={filter === "unread" ? "Unread" : "Inbox"}
          right={
            <span className="flex items-center gap-2 text-[11px] text-faint tabular-nums">
              {loading && notifications.length > 0 && <Spinner label="Refreshing" className="size-3.5" />}
              {totalPages > 1 ? `Page ${page} / ${totalPages}` : `${visible.length} shown`}
            </span>
          }
        />

        {loading && notifications.length === 0 ? (
          <LoadingBlock label="Loading notifications" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={filter === "unread" ? CheckCheck : BellOff}
            title={filter === "unread" ? "No unread notifications" : "No notifications"}
            description={
              filter === "unread"
                ? "Nothing new on this page. Switch to All to see earlier alerts."
                : "You're all caught up! Likes, follows, comments and messages will show up here."
            }
            action={
              filter === "unread" && notifications.length > 0 ? (
                <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                  Show all
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((notification) => (
              <NotificationItem key={notification._id} notification={notification} />
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3 sm:flex-row">
            <p className="text-[11px] text-faint tabular-nums">
              Showing {first}–{last} of {pagination.totalCount}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={ChevronLeft}
                onClick={() => handlePageChange(page - 1)}
                disabled={!pagination.hasPrevPage || loading}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                iconRight={ChevronRight}
                onClick={() => handlePageChange(page + 1)}
                disabled={!pagination.hasNextPage || loading}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </Page>
  );
}

export default NotificationsPage;
