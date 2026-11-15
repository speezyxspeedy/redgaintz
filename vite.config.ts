import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = (env.VITE_BASE_PATH || "/").replace(/\/?$/, "/");
  const cesiumBuild = "node_modules/cesium/Build/Cesium";

  return {
    base,
    publicDir: false,
    define: {
      CESIUM_BASE_URL: JSON.stringify(`${base}cesium/`),
    },
    esbuild: mode === "production" ? { drop: ["console", "debugger"] } : {},
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: { output: { manualChunks: (id: string) => (id.includes("node_modules/three") ? "three" : id.includes("node_modules/recharts") || id.includes("node_modules/d3-") ? "charts" : id.includes("node_modules/cesium") ? "cesium" : undefined) } },
    },
    plugins: [
      react(),
      {
        name: "terrascan-csp",
        transformIndexHtml(html: string, ctx: { server?: unknown }) {
          if (ctx.server) return html; // dev server needs inline scripts for hot reload
          const csp = "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: ; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'";
          return html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
        },
      },
      viteStaticCopy({
        targets: [
          { src: `${cesiumBuild}/Workers/**/*`, dest: "cesium/Workers" },
          {
            src: `${cesiumBuild}/ThirdParty/**/*`,
            dest: "cesium/ThirdParty",
          },
          { src: `${cesiumBuild}/Assets/**/*`, dest: "cesium/Assets" },
          { src: `${cesiumBuild}/Widgets/**/*`, dest: "cesium/Widgets" },
          { src: "boundaries/**/*", dest: "boundaries" },
          { src: "config/*.json", dest: "config" },
          { src: "artifacts/**/*", dest: "artifacts" },
        ],
      }),
    ],
    server: {
      proxy: {
        "/api": env.VITE_API_BASE_URL || "http://127.0.0.1:8000",
      },
    },
  };
});
