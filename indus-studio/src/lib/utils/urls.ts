import { browser } from '$app/environment';
import { apiClient } from '$api/client';

function trimTrailingSlash(value: string): string {
	return value.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
	return trimTrailingSlash(apiClient.getBaseUrl());
}

export function getDocsBaseUrl(): string {
	const configured = import.meta.env.PUBLIC_DOCS_URL;
	if (configured) {
		return trimTrailingSlash(configured);
	}

	if (!browser) {
		return 'http://localhost:4321';
	}

	const { protocol, hostname, port } = window.location;
	if (hostname === 'localhost' || hostname === '127.0.0.1') {
		return `${protocol}//${hostname}:${port === '4321' ? port : '4321'}`;
	}

	return `${protocol}//docs.${hostname}`;
}

export function getDocsUrl(path = ''): string {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return `${getDocsBaseUrl()}${path ? normalizedPath : ''}`;
}

export function getRealtimeWebSocketUrl(): string {
	return getApiBaseUrl().replace(/^http/i, 'ws') + '/realtime/v1/websocket';
}
