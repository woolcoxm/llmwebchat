import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// Dev: the proxy runs on :8787. We proxy /api → it so the browser talks to one origin.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "inline",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "LLMWebChat",
        short_name: "LLMWebChat",
        description: "An advanced, provider-agnostic LLM web chat interface.",
        theme_color: "#0a0a0b",
        background_color: "#0a0a0b",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Never cache the proxy API — always go to network (streaming + secrets).
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,ttf}"],
      },
      runtimeCaching: [
        {
          urlPattern: /\/api\//,
          handler: "NetworkOnly",
          method: "POST",
        },
      ],
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "../../apps/server/web-dist",
    emptyOutDir: true,
  },
});
