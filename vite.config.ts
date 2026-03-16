import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("node_modules/lucide-react/")) {
            return "icons-vendor";
          }

          if (id.includes("node_modules/read-excel-file/")) {
            return "excel-vendor";
          }

          if (id.includes("node_modules/zod/")) {
            return "data-vendor";
          }

          return undefined;
        },
      },
    },
  },
  plugins: [
    tailwindcss(),
    devtools(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    port: 3000,
    strictPort: true,
    host: "0.0.0.0",
  },
});
