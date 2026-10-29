import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	root: "web",
	plugins: [react()],
	resolve: {
		alias: {
			"@shared": fileURLToPath(new URL("./shared", import.meta.url)),
		},
	},
	server: {
		port: 5173,
		proxy: {
			"/api": "http://127.0.0.1:5602",
			"/ws": { target: "ws://127.0.0.1:5602", ws: true },
			"/preview": "http://127.0.0.1:5602",
			"/w/": "http://127.0.0.1:5602",
		},
	},
	build: {
		outDir: "../web-dist",
		emptyOutDir: true,
	},
});
