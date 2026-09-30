import {
  Bell,
  Heart,
  Home,
  MessagesSquare,
  Newspaper,
  Package,
  Radio,
  ReceiptText,
  Search,
  Settings,
  ShoppingCart,
  Store,
  UserRound,
  Warehouse,
} from "lucide-react";

export const NAV_GROUPS = [
  {
    label: "Workspace",
    items: [
      { id: "home", label: "Home", short: "Home", icon: Home, path: "/dashboard" },
      { id: "feed", label: "Feed", short: "Feed", icon: Newspaper, path: "/post" },
      { id: "chat", label: "Messages", short: "Chats", icon: MessagesSquare, path: "/chat" },
      { id: "live", label: "Live streams", short: "Live", icon: Radio, path: "/streams" },
      { id: "search", label: "Search", short: "Search", icon: Search, path: "/search" },
      {
        id: "notifications",
        label: "Notifications",
        short: "Alerts",
        icon: Bell,
        path: "/notification",
        showUnread: true,
      },
      { id: "profile", label: "Profile", short: "Me", icon: UserRound, path: "/profile/me" },
      { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { id: "stores", label: "Stores", icon: Store, path: "/stores", exact: true },
      { id: "products", label: "Products", icon: Package, path: "/products" },
      { id: "my-store", label: "My store", icon: Warehouse, path: "/my-store" },
      { id: "cart", label: "Cart", icon: ShoppingCart, path: "/cart", showCart: true },
      { id: "wishlist", label: "Wishlist", icon: Heart, path: "/wishlist" },
      { id: "orders", label: "My orders", icon: ReceiptText, path: "/orders" },
    ],
  },
];

// Six most-used destinations for the mobile bottom bar
export const MOBILE_NAV = ["home", "feed", "chat", "live", "stores", "profile"].map((id) =>
  NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === id),
);

export const isNavActive = (item, pathname) =>
  item.exact ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`);
