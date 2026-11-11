/// <reference types="@sveltejs/kit" />
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

// Create a unique cache name for this version
const CACHE_NAME = `cache-${version}`;

const ASSETS = [
	...immutable,
	...assets
];

self.addEventListener('install', (event: any) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE_NAME);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event: any) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE_NAME) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

self.addEventListener('fetch', (event: any) => {
	if (event.request.method !== 'GET') return;
	const url = new URL(event.request.url);

	// Bypass external Firebase APIs
	if (url.origin.includes('googleapis.com') || url.origin.includes('firebaseio.com')) {
		return;
	}

	async function respond() {
		const cache = await caches.open(CACHE_NAME);

		if (ASSETS.includes(url.pathname)) {
			const cachedResponse = await cache.match(url.pathname);
			if (cachedResponse) return cachedResponse;
		}

		try {
			const response = await fetch(event.request);
			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}
			return response;
		} catch (err) {
			const cachedResponse = await cache.match(event.request);
			if (cachedResponse) return cachedResponse;
			throw err;
		}
	}

	event.respondWith(respond());
});
