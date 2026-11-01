interface ImportMetaEnv {
	readonly VITE_VAPID_PUBLIC_KEY?: string;
	readonly VITE_PUSH_API_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
