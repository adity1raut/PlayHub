import React from "react";
import ReactDOM from "react-dom/client";
import "./lib/config"; // sets axios defaults (credentials) before anything else runs
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { NotificationProvider } from "./context/NotificationContext";
import { StoreProvider } from "./context/StoreContext";
import { ProductProvider } from "./context/ProductContext";
import { Toaster } from "./lib/toast";
import { registerServiceWorker } from "./lib/push";

registerServiceWorker(); // Web Push service worker (public/sw.js)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <StoreProvider>
              <ProductProvider>
                <App />
                <Toaster />
              </ProductProvider>
            </StoreProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
