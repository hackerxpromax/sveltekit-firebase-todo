export const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoDummyApiKeyForFirebaseSSR12345',
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'sveltekit-ssr-demo.firebaseapp.com',
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sveltekit-ssr-demo',
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'sveltekit-ssr-demo.firebasestorage.app',
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
	appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789012:web:abcdef1234567890abcdef'
};

export const isFirebaseConfigured = Boolean(
	import.meta.env.VITE_FIREBASE_API_KEY &&
	import.meta.env.VITE_FIREBASE_PROJECT_ID &&
	!import.meta.env.VITE_FIREBASE_API_KEY.includes('DemoDummy')
);
