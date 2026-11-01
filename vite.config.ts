import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			strategies: "injectManifest",
			srcDir: "src",
			filename: "sw.ts",
			// The service worker is registered as a classic script, so bundle it as one.
			injectManifest: { rollupFormat: "iife" },
			registerType: "autoUpdate",
			injectRegister: "auto",
			devOptions: { enabled: true, type: "module" },
			manifest: {
				name: "Workout Tracker",
				short_name: "Workout",
				description: "自分専用のワークアウト記録",
				lang: "ja",
				start_url: "/",
				scope: "/",
				display: "standalone",
				orientation: "portrait",
				background_color: "#16202a",
				theme_color: "#16202a",
				icons: [
					{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
					{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
					{
						src: "/icons/maskable-512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
					},
				],
			},
		}),
	],
});
