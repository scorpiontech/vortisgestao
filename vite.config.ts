import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// Identificador único gerado a cada build (versão dos arquivos publicados)
const buildVersion = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);

// Gera dist/version.json no fim do build para que o app detecte novas versões
function versionManifest(version: string): Plugin {
  return {
    name: "vortis-version-manifest",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(
        path.join(outDir, "version.json"),
        JSON.stringify({ version, builtAt: new Date().toISOString() }, null, 2),
      );
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(mode === "development" ? "dev" : buildVersion),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    versionManifest(buildVersion),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
