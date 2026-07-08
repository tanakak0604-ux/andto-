import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // CRA時代の環境変数名（REACT_APP_*）をそのまま使えるようにする（Vercelの設定変更不要）
  envPrefix: ["VITE_", "REACT_APP_"],
  build: {
    outDir: "build", // CRAと同じ出力先（Vercelのプロジェクト設定に合わせる）
  },
  test: {
    environment: "jsdom",
  },
});
