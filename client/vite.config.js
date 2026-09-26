import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Where the dev proxy forwards /api, /socket.io and /uploads when VITE_BACKEND_URL is empty
  const proxyTarget = env.VITE_PROXY_TARGET || env.VITE_BACKEND_URL || "http://localhost:4000";

  return {
    plugins: [react(), tailwindcss()],
    build: {
      outDir: "dist",
      sourcemap: false,
      minify: "esbuild",
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ["react", "react-dom", "react-router-dom"],
            ui: ["lucide-react", "framer-motion"],
          },
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      watch: {
        usePolling: true,
      },
      proxy: {
        "/api": { target: proxyTarget, changeOrigin: true, secure: false },
        "/uploads": { target: proxyTarget, changeOrigin: true, secure: false },
        "/socket.io": { target: proxyTarget, changeOrigin: true, secure: false, ws: true },
      },
    },
  };
});
