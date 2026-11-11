// Firebase Client Configuration
// Sẵn sàng chạy ngay lập tức khi clone về (Zero-config out of the box)
export const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCyzA3rEJzpnFHH_5ZrEqtBi5CIAK0GQrk',
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'planning-with-ai-57aa8.firebaseapp.com',
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'planning-with-ai-57aa8',
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'planning-with-ai-57aa8.firebasestorage.app',
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '679150388471',
	appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:679150388471:web:fa65f6d08c1196c19e7ff2'
};

export const isFirebaseConfigured = Boolean(
	firebaseConfig.apiKey &&
	firebaseConfig.projectId &&
	!firebaseConfig.apiKey.includes('DemoDummy')
);
