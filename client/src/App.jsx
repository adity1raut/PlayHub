import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import PublicRoute from "./context/PublicRoute";
import ProtectedRoute from "./context/ProtectedRoute";
import ProfilePage from "./components/ProfilePage/ProfilePage";
import Login from "./components/LoginForm/Login";
import RegistrationForm from "./components/RegistrationForm/RegistrationForm";
import GamingDashboard from "./components/Home";
import Navbar from "./components/Navbar/Navbar";
import ForgetPassword from "./components/ForgetPassword/ForgetPass";
import ChatApp from "./components/ChatPAge/chat/ChatApplication";
import NotificationPage from "./components/Notification/NotificationsPage";
import { NotificationProvider } from "./context/NotificationContext";
import Footer from "./components/Footer/Footer";
import Feed from "./components/Post/PostFeed";
import MyPosts from "./components/Post/MyPosts";
import MyStore from "./Store/components/MyStore";
import AllStores from "./Store/components/AllStores";
import AddProduct from "./Store/product/AddProduct";
import EditProduct from "./Store/product/EditProduct";
import ProductDetail from "./Store/product/ProductDetail";
import PublicProducts from "./Store/product/PublicProduct";
import Cart from "./Store/Card/Cart";
import { ProductSearch } from "./Store/search/ProductSearch";
import { Wishlist } from "./Store/search/Wishlist";
import Checkout from "./Store/order/Checkout";
import { AuthProvider } from "./context/AuthContext";
import StreamViewer from "./Stream/StreamViewer";
import StreamsList from "./Stream/StreamsList";
import Loader from "./components/Loader/Loader";

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        setIsLoading(false);
      } catch (error) {
        console.error("App initialization error:", error);
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <NotificationProvider>
      <AuthProvider>
        <Router>
          <Navbar />

          <Routes>
            {/* Public Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <GamingDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicRoute>
                  <RegistrationForm />
                </PublicRoute>
              }
            />

            <Route
              path="/forgot-password"
              element={
                <PublicRoute>
                  <ForgetPassword />
                </PublicRoute>
              }
            />

            {/* Protected Routes */}
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <ChatApp />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile/me"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/profile/:username"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/notification"
              element={
                <ProtectedRoute>
                  <NotificationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/myposts"
              element={
                <ProtectedRoute>
                  <MyPosts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/post"
              element={
                <ProtectedRoute>
                  <Feed />
                </ProtectedRoute>
              }
            />

            <Route
              path="/my-store"
              element={
                <ProtectedRoute>
                  <MyStore />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stores"
              element={
                <ProtectedRoute>
                  <AllStores />
                </ProtectedRoute>
              }
            />

            {/* Product Routes */}
            <Route
              path="/products"
              element={
                <ProtectedRoute>
                  <PublicProducts />
                </ProtectedRoute>
              }
            />

            <Route
              path="/products/:productId"
              element={
                <ProtectedRoute>
                  <ProductDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/add-product"
              element={
                <ProtectedRoute>
                  <AddProduct />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit-product/:productId"
              element={
                <ProtectedRoute>
                  <EditProduct />
                </ProtectedRoute>
              }
            />

            {/* Cart Routes */}
            <Route
              path="/cart"
              element={
                <ProtectedRoute>
                  <Cart />
                </ProtectedRoute>
              }
            />

            {/* Checkout Route */}
            <Route
              path="/checkout"
              element={
                <ProtectedRoute>
                  <Checkout />
                </ProtectedRoute>
              }
            />
            <Route path="/search" element={<ProductSearch />} />

            <Route
              path="/wishlist"
              element={
                <ProtectedRoute>
                  <Wishlist />
                </ProtectedRoute>
              }
            />

            {/* Stream Routes */}
            <Route
              path="/streams"
              element={
                <ProtectedRoute>
                  <StreamsList />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stream/:id"
              element={
                <ProtectedRoute>
                  <StreamViewer />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          <Footer />
        </Router>
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
