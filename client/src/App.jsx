import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import PublicRoute from "./routes/PublicRoute";
import ProtectedRoute, { FullScreenLoader } from "./routes/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import AppShell from "./components/layout/AppShell";
import NotificationToaster from "./features/notifications/NotificationToaster";
import LandingPage from "./features/landing/LandingPage";
import Login from "./features/auth/Login";
import RegistrationForm from "./features/auth/Register";
import ForgetPassword from "./features/auth/ForgotPassword";
import Dashboard from "./features/dashboard/Dashboard";
import ChatApp from "./features/chat/ChatApplication";
import ProfilePage from "./features/profile/ProfilePage";
import NotificationPage from "./features/notifications/NotificationsPage";
import SearchPage from "./features/search/SearchPage";
import SettingsPage from "./features/settings/SettingsPage";
import Feed from "./features/posts/PostFeed";
import MyPosts from "./features/posts/MyPosts";
import SinglePost from "./features/posts/SinglePost";
import MyStore from "./features/store/stores/MyStore";
import AllStores from "./features/store/stores/AllStores";
import AddProduct from "./features/store/products/AddProduct";
import EditProduct from "./features/store/products/EditProduct";
import ProductDetail from "./features/store/products/ProductDetail";
import PublicProducts from "./features/store/products/PublicProduct";
import Cart from "./features/store/cart/Cart";
import { ProductSearch } from "./features/store/products/ProductSearch";
import { Wishlist } from "./features/store/cart/Wishlist";
import Checkout from "./features/store/checkout/Checkout";
import OrdersPage from "./features/store/orders/OrdersPage";
import StreamsList from "./features/stream/StreamsList";
import { LoadingBlock } from "./components/ui";

// Live video (WebRTC/SFU client) is only downloaded when a stream is opened
const StreamViewer = lazy(() => import("./features/stream/StreamViewer"));

/** "/" shows the landing page to guests and sends signed-in users to their workspace. */
function RootRoute() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

function App() {
  return (
    <Router>
      {/* Lets realtime notification pop-ups navigate inside the app */}
      <NotificationToaster />
      <Routes>
        <Route path="/" element={<RootRoute />} />

        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><RegistrationForm /></PublicRoute>} />
        <Route path="/registration" element={<Navigate to="/signup" replace />} />
        <Route path="/forgot-password" element={<PublicRoute><ForgetPassword /></PublicRoute>} />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat" element={<ChatApp />} />
          <Route path="/chat/:conversationId" element={<ChatApp />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/notification" element={<NotificationPage />} />
          <Route path="/notifications" element={<Navigate to="/notification" replace />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="/profile" element={<Navigate to="/profile/me" replace />} />
          <Route path="/profile/me" element={<ProfilePage />} />
          <Route path="/profile/:username" element={<ProfilePage />} />

          <Route path="/post" element={<Feed />} />
          <Route path="/post/:postId" element={<SinglePost />} />
          <Route path="/posts/:postId" element={<SinglePost />} />
          <Route path="/myposts" element={<MyPosts />} />

          <Route path="/streams" element={<StreamsList />} />
          <Route
            path="/stream/:id"
            element={
              <Suspense fallback={<LoadingBlock label="Loading stream" />}>
                <StreamViewer />
              </Suspense>
            }
          />

          <Route path="/stores" element={<AllStores />} />
          <Route path="/my-store" element={<MyStore />} />
          <Route path="/products" element={<PublicProducts />} />
          <Route path="/products/search" element={<ProductSearch />} />
          <Route path="/products/:productId" element={<ProductDetail />} />
          <Route path="/add-product" element={<AddProduct />} />
          <Route path="/edit-product/:productId" element={<EditProduct />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/wishlist" element={<Wishlist />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
