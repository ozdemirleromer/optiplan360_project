import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const baseFromEnv = (env.VITE_API_BASE_URL || "").trim();
  const proxyTargetFromEnv = (env.VITE_API_PROXY_TARGET || "").trim();
  const apiProxyTarget =
    proxyTargetFromEnv ||
    (/^https?:\/\//i.test(baseFromEnv) ? baseFromEnv : "http://127.0.0.1:8080");

  return {
    plugins: [react()],
    css: {
      postcss: {
        plugins: []
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom"],
            "ui-vendor": ["lucide-react"],
            router: ["react-router-dom"],
            "export-jspdf": ["jspdf"],
            "export-xlsx": ["xlsx"],
            i18n: ["i18next", "react-i18next", "i18next-browser-languagedetector"],
            state: ["zustand"],
          },
          chunkFileNames: "assets/js/[name]-[hash].js",
          entryFileNames: "assets/js/[name]-[hash].js",
          assetFileNames: (info) => {
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(info.name || "")) {
              return "assets/images/[name]-[hash][extname]";
            }
            if (/\.(woff2?|ttf|otf|eot)$/i.test(info.name || "")) {
              return "assets/fonts/[name]-[hash][extname]";
            }
            return "assets/[extname]/[name]-[hash][extname]";
          },
        },
      },
      chunkSizeWarningLimit: 600,
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      sourcemap: false,
    },
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3005,
      strictPort: false,
      host: "127.0.0.1",
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
