import { getApps, getApp, initializeApp } from 'firebase/app';
import {
	getAuth,
	signInAnonymously as fbSignInAnonymously,
	signInWithEmailAndPassword as fbSignInWithEmail,
	createUserWithEmailAndPassword as fbCreateUserWithEmail,
	signOut as fbSignOut,
	updateProfile as fbUpdateProfile,
	onAuthStateChanged,
	type User
} from 'firebase/auth';
import {
	getFirestore,
	collection,
	query,
	where,
	orderBy,
	getDocs,
	addDoc,
	updateDoc,
	deleteDoc,
	doc,
	onSnapshot,
	type Unsubscribe
} from 'firebase/firestore';
import {
	getStorage,
	ref,
	uploadBytes,
	getDownloadURL
} from 'firebase/storage';
import { firebaseConfig, isFirebaseConfigured } from './config';
import type { Todo, Priority, UserProfile } from '../types/todo';

function getClientFirebaseApp() {
	if (getApps().length > 0) {
		return getApp();
	}
	return initializeApp(firebaseConfig);
}

export const clientApp = typeof window !== 'undefined' ? getClientFirebaseApp() : null;
export const clientAuth = typeof window !== 'undefined' && clientApp ? getAuth(clientApp) : null;
export const clientDb = typeof window !== 'undefined' && clientApp ? getFirestore(clientApp) : null;
export const clientStorage = typeof window !== 'undefined' && clientApp ? getStorage(clientApp) : null;

// Local storage fallback for offline / mock testing
const LOCAL_STORAGE_KEY = 'sveltekit_firebase_todos';

function getLocalTodos(): Todo[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
		if (raw) return JSON.parse(raw);
	} catch (e) {
		console.warn('localStorage read error:', e);
	}
	return [
		{
			id: 'todo-1',
			title: 'Deploy Firebase Classic Hosting (Free 100%)',
			description: 'Chạy static SPA với global CDN, bảo vệ bằng Firestore rules.',
			completed: true,
			priority: 'high',
			category: 'DevOps',
			createdAt: Date.now() - 3600000,
			userId: 'guest'
		},
		{
			id: 'todo-2',
			title: 'Tối ưu Selective Realtime Firestore',
			description: 'Bật onSnapshot khi cần sync tức thời, tắt khi xem danh sách thường.',
			completed: false,
			priority: 'medium',
			category: 'Performance',
			createdAt: Date.now() - 1800000,
			userId: 'guest'
		}
	];
}

function saveLocalTodos(todos: Todo[]) {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos));
	} catch (e) {
		console.warn('localStorage save error:', e);
	}
}

/**
 * Maps Firebase User object to lightweight UserProfile
 */
export function mapFirebaseUser(user: User | null): UserProfile | null {
	if (!user) return null;
	return {
		uid: user.uid,
		email: user.email,
		displayName: user.displayName || (user.isAnonymous ? 'Khách Ẩn Danh' : user.email?.split('@')[0] || 'User'),
		isAnonymous: user.isAnonymous,
		photoURL: user.photoURL
	};
}

/**
 * Listens for Auth changes on the client.
 */
export function initAuthSync(callback: (profile: UserProfile | null) => void) {
	if (!clientAuth) return () => {};

	return onAuthStateChanged(clientAuth, (user) => {
		callback(mapFirebaseUser(user));
	});
}

/**
 * Client Auth: Anonymous Sign-in
 */
export async function loginAnonymously(): Promise<UserProfile> {
	if (!isFirebaseConfigured || !clientAuth) {
		const demoUser: UserProfile = {
			uid: 'guest-' + Math.random().toString(36).substring(2, 7),
			email: null,
			displayName: 'Khách Demo (Local)',
			isAnonymous: true
		};
		return demoUser;
	}

	const cred = await fbSignInAnonymously(clientAuth);
	return mapFirebaseUser(cred.user)!;
}

/**
 * Client Auth: Sign In with Email & Password
 */
export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
	if (!isFirebaseConfigured || !clientAuth) {
		const demoUser: UserProfile = {
			uid: 'user-' + btoa(email).substring(0, 8),
			email,
			displayName: email.split('@')[0],
			isAnonymous: false
		};
		return demoUser;
	}

	const cred = await fbSignInWithEmail(clientAuth, email, pass);
	return mapFirebaseUser(cred.user)!;
}

/**
 * Client Auth: Register a New User with Email, Password & Display Name
 */
export async function registerWithEmail(
	email: string,
	pass: string,
	displayName?: string
): Promise<UserProfile> {
	if (!isFirebaseConfigured || !clientAuth) {
		const demoUser: UserProfile = {
			uid: 'user-' + btoa(email).substring(0, 8),
			email,
			displayName: displayName || email.split('@')[0],
			isAnonymous: false
		};
		return demoUser;
	}

	const cred = await fbCreateUserWithEmail(clientAuth, email, pass);
	if (displayName && cred.user) {
		try {
			await fbUpdateProfile(cred.user, { displayName });
		} catch (e) {
			console.warn('Update profile failed:', e);
		}
	}
	return mapFirebaseUser(cred.user)!;
}

/**
 * Client Auth: Sign Out
 */
export async function logout(): Promise<void> {
	if (isFirebaseConfigured && clientAuth) {
		await fbSignOut(clientAuth);
	}
}

/**
 * Helper to compress and convert an image file to Base64 data URL
 */
function compressImage(file: File, maxWidth = 1000, quality = 0.8): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement('canvas');
				let width = img.width;
				let height = img.height;

				if (width > maxWidth) {
					height = Math.round((height * maxWidth) / width);
					width = maxWidth;
				}

				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					resolve(e.target?.result as string);
					return;
				}
				ctx.drawImage(img, 0, 0, width, height);
				resolve(canvas.toDataURL('image/jpeg', quality));
			};
			img.onerror = () => resolve(e.target?.result as string);
			img.src = e.target?.result as string;
		};
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

/**
 * Upload Image: Attempts Firebase Cloud Storage first,
 * falling back gracefully to optimized Base64 if Storage bucket is not yet provisioned.
 */
export async function uploadTodoImage(file: File, userId: string): Promise<string> {
	// First compress the image
	const base64Data = await compressImage(file);

	if (!isFirebaseConfigured || !clientStorage) {
		return base64Data;
	}

	try {
		const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
		const storageRef = ref(clientStorage, `todos/${userId}/${filename}`);
		await uploadBytes(storageRef, file);
		const downloadUrl = await getDownloadURL(storageRef);
		return downloadUrl;
	} catch (err) {
		console.warn('[Firebase Storage] Upload to bucket failed, using local/inline base64 fallback:', err);
		return base64Data;
	}
}

/**
 * Fetch todos from Cloud Firestore (or local fallback)
 */
export async function fetchTodosClient(userId: string): Promise<Todo[]> {
	if (!isFirebaseConfigured || !clientDb) {
		return getLocalTodos();
	}

	try {
		const todosRef = collection(clientDb, 'todos');
		const q = query(
			todosRef,
			where('userId', '==', userId),
			orderBy('createdAt', 'desc')
		);
		const snap = await getDocs(q);
		return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Todo, 'id'>) }));
	} catch (err) {
		console.warn('[Firestore] fetchTodosClient fallback to local storage:', err);
		return getLocalTodos();
	}
}

/**
 * Add a new todo to Cloud Firestore
 */
export async function addTodoClient(
	todoData: {
		title: string;
		description?: string;
		priority: Priority;
		category: string;
		imageUrl?: string;
	},
	userId: string
): Promise<Todo> {
	const newTodo: Todo = {
		id: `todo-${Date.now()}`,
		title: todoData.title,
		description: todoData.description || '',
		completed: false,
		priority: todoData.priority,
		category: todoData.category || 'General',
		createdAt: Date.now(),
		userId,
		imageUrl: todoData.imageUrl || ''
	};

	if (!isFirebaseConfigured || !clientDb) {
		const list = getLocalTodos();
		list.unshift(newTodo);
		saveLocalTodos(list);
		return newTodo;
	}

	try {
		const todosRef = collection(clientDb, 'todos');
		const docRef = await addDoc(todosRef, {
			title: newTodo.title,
			description: newTodo.description,
			completed: newTodo.completed,
			priority: newTodo.priority,
			category: newTodo.category,
			createdAt: newTodo.createdAt,
			userId,
			imageUrl: newTodo.imageUrl || ''
		});
		return { ...newTodo, id: docRef.id };
	} catch (err) {
		console.warn('[Firestore] addDoc failed, using local storage:', err);
		const list = getLocalTodos();
		list.unshift(newTodo);
		saveLocalTodos(list);
		return newTodo;
	}
}

/**
 * Toggle todo completion in Cloud Firestore
 */
export async function toggleTodoClient(todoId: string, completed: boolean, userId: string): Promise<void> {
	if (!isFirebaseConfigured || !clientDb) {
		const list = getLocalTodos();
		const item = list.find((t) => t.id === todoId);
		if (item) item.completed = completed;
		saveLocalTodos(list);
		return;
	}

	try {
		const docRef = doc(clientDb, 'todos', todoId);
		await updateDoc(docRef, { completed });
	} catch (err) {
		console.warn('[Firestore] updateDoc failed, using local storage:', err);
		const list = getLocalTodos();
		const item = list.find((t) => t.id === todoId);
		if (item) item.completed = completed;
		saveLocalTodos(list);
	}
}

/**
 * Delete a todo from Cloud Firestore
 */
export async function deleteTodoClient(todoId: string, userId: string): Promise<void> {
	if (!isFirebaseConfigured || !clientDb) {
		const list = getLocalTodos();
		const updated = list.filter((t) => t.id !== todoId);
		saveLocalTodos(updated);
		return;
	}

	try {
		const docRef = doc(clientDb, 'todos', todoId);
		await deleteDoc(docRef);
	} catch (err) {
		console.warn('[Firestore] deleteDoc failed, using local storage:', err);
		const list = getLocalTodos();
		const updated = list.filter((t) => t.id !== todoId);
		saveLocalTodos(updated);
	}
}

/**
 * Selective Realtime Listener (onSnapshot)
 */
export function subscribeToTodos(
	userId: string,
	onUpdate: (todos: Todo[]) => void,
	onError?: (err: Error) => void
): Unsubscribe {
	if (!isFirebaseConfigured || !clientDb) {
		onUpdate(getLocalTodos());
		return () => {};
	}

	try {
		const todosRef = collection(clientDb, 'todos');
		const q = query(
			todosRef,
			where('userId', '==', userId),
			orderBy('createdAt', 'desc')
		);

		return onSnapshot(
			q,
			(snapshot) => {
				const todos = snapshot.docs.map((docSnap) => ({
					id: docSnap.id,
					...(docSnap.data() as Omit<Todo, 'id'>)
				}));
				onUpdate(todos);
			},
			(err) => {
				console.warn('[Realtime] Firestore onSnapshot error:', err);
				if (onError) onError(err);
			}
		);
	} catch (err) {
		console.warn('[Realtime] Failed to setup onSnapshot:', err);
		return () => {};
	}
}
