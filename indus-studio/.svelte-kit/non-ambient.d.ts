
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/(auth)" | "/(app)" | "/" | "/(app)/ai" | "/(app)/audit" | "/(app)/auth-users" | "/(app)/billing" | "/(app)/dashboard" | "/(app)/dpdp" | "/(app)/enterprise" | "/(app)/enterprise/sso" | "/(app)/flags" | "/(auth)/login" | "/(app)/notifications" | "/(app)/onboarding" | "/(app)/queue" | "/(app)/realtime" | "/(app)/secrets" | "/(app)/security" | "/(app)/settings" | "/(auth)/signup" | "/(app)/sql-editor" | "/(app)/status" | "/(app)/storage" | "/(app)/support" | "/(app)/table-editor" | "/(app)/table-editor/[table]" | "/(app)/trust-center";
		RouteParams(): {
			"/(app)/table-editor/[table]": { table: string }
		};
		LayoutParams(): {
			"/(auth)": Record<string, never>;
			"/(app)": { table?: string };
			"/": { table?: string };
			"/(app)/ai": Record<string, never>;
			"/(app)/audit": Record<string, never>;
			"/(app)/auth-users": Record<string, never>;
			"/(app)/billing": Record<string, never>;
			"/(app)/dashboard": Record<string, never>;
			"/(app)/dpdp": Record<string, never>;
			"/(app)/enterprise": Record<string, never>;
			"/(app)/enterprise/sso": Record<string, never>;
			"/(app)/flags": Record<string, never>;
			"/(auth)/login": Record<string, never>;
			"/(app)/notifications": Record<string, never>;
			"/(app)/onboarding": Record<string, never>;
			"/(app)/queue": Record<string, never>;
			"/(app)/realtime": Record<string, never>;
			"/(app)/secrets": Record<string, never>;
			"/(app)/security": Record<string, never>;
			"/(app)/settings": Record<string, never>;
			"/(auth)/signup": Record<string, never>;
			"/(app)/sql-editor": Record<string, never>;
			"/(app)/status": Record<string, never>;
			"/(app)/storage": Record<string, never>;
			"/(app)/support": Record<string, never>;
			"/(app)/table-editor": { table?: string };
			"/(app)/table-editor/[table]": { table: string };
			"/(app)/trust-center": Record<string, never>
		};
		Pathname(): "/" | "/ai" | "/audit" | "/auth-users" | "/billing" | "/dashboard" | "/dpdp" | "/enterprise/sso" | "/flags" | "/login" | "/notifications" | "/onboarding" | "/queue" | "/realtime" | "/secrets" | "/security" | "/settings" | "/signup" | "/sql-editor" | "/status" | "/storage" | "/support" | "/table-editor" | `/table-editor/${string}` & {} | "/trust-center";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}