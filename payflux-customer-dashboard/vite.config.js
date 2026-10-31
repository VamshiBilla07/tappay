import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";

/**
 * The camera (getUserMedia) and Web NFC are only exposed in a secure context.
 * `localhost` counts as secure, a phone hitting http://192.168.x.x:5174 does not,
 * so `npm run dev:https` serves the same app over a self-signed certificate.
 */
export default defineConfig(({ command }) => {
  const https = process.env.HTTPS === "1" || process.env.HTTPS === "true";
  return {
    plugins: [react(), ...(command === "serve" && https ? [basicSsl()] : [])],
    server: {
      host: true,
      proxy: {
        "/api": {
          target: process.env.PAYFLUX_API || "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
  };
});
