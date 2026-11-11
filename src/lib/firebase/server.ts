import { initializeServerApp, type FirebaseServerApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
	getFirestore,
	collection,
	getDocs,
	doc,
	addDoc,
	updateDoc,
	deleteDoc,
	query,
	where,
	orderBy
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './config';
import type { Todo, Priority } from '../types/todo';

// In-memory fallback cache for development/demo when real Firebase keys aren't yet provisioned
const demoStore = new Map<string, Todo[]>();

function getDemoTodos(userId: string): Todo[] {
	if (!demoStore.has(userId)) {
		demoStore.set(userId, [
			{
				id: 'todo-1',
				title: 'Cài đặt SvelteKit + FirebaseServerApp cho SSR',
				description: 'Khởi tạo FirebaseServerApp trong +page.server.ts với authIdToken để bảo mật context người dùng.',
				completed: true,
				priority: 'high',
				category: 'Architecture',
				createdAt: Date.now() - 3600000 * 2,
				userId
			},
			{
				id: 'todo-2',
				title: 'Xử lý CRUD bằng SvelteKit Form Actions',
				description: 'Tận dụng HTML form actions và use:enhance để app hoạt động mượt mà kể cả khi không có JS.',
				completed: true,
				priority: 'medium',
				category: 'Backend',
				createdAt: Date.now() - 3600000,
				userId
			},
			{
				id: 'todo-3',
				title: 'Tối ưu Realtime Firestore Listener (onSnapshot)',
				description: 'Chỉ kích hoạt listener tại những vùng cần realtime thay vì bật toàn bộ để tiết kiệm chi phí đọc.',
				completed: false,
				priority: 'high',
				category: 'Performance',
				createdAt: Date.now() - 1800000,
				userId
			},
			{
				id: 'todo-4',
				title: 'Cấu hình PWA & Firebase App Hosting',
				description: 'Tạo manifest.webmanifest, service-worker cache và file cấu hình apphosting.yaml cho Node buildpack.',
				completed: false,
				priority: 'low',
				category: 'DevOps',
				createdAt: Date.now() - 900000,
				userId
			}
		]);
	}
	return demoStore.get(userId)!;
}

export interface ServerUser {
	uid: string;
	email: string | null;
	displayName: string | null;
	isAnonymous: boolean;
}

/**
 * Initializes a scoped FirebaseServerApp for the current server request.
 * Passing `authIdToken` ensures that Firestore security rules are evaluated
 * under the authenticated user context rather than using Admin SDK privileges.
 */
export async function getServerFirebase(authIdToken?: string | null): Promise<{
	serverApp: FirebaseServerApp | null;
	auth: any | null;
	db: any | null;
	currentUser: ServerUser | null;
	isDemo: boolean;
}> {
	if (!isFirebaseConfigured) {
		return {
			serverApp: null,
			auth: null,
			db: null,
			currentUser: authIdToken
				? {
						uid: 'user-demo-123',
						email: 'demo@example.com',
						displayName: 'Demo User (SSR)',
						isAnonymous: false
					}
				: null,
			isDemo: true
		};
	}

	try {
		const serverApp = initializeServerApp(firebaseConfig, {
			authIdToken: authIdToken || undefined
		});

		const auth = getAuth(serverApp);
		const db = getFirestore(serverApp);

		if (authIdToken) {
			await auth.authStateReady();
		}

		const user = auth.currentUser;
		const currentUser: ServerUser | null = user
			? {
					uid: user.uid,
					email: user.email,
					displayName: user.displayName,
					isAnonymous: user.isAnonymous
				}
			: null;

		return {
			serverApp,
			auth,
			db,
			currentUser,
			isDemo: false
		};
	} catch (err) {
		console.warn('[FirebaseServerApp] Falling back to demo mode:', err);
		return {
			serverApp: null,
			auth: null,
			db: null,
			currentUser: authIdToken
				? {
						uid: 'user-demo-123',
						email: 'demo@example.com',
						displayName: 'Demo User (SSR)',
						isAnonymous: false
					}
				: null,
			isDemo: true
		};
	}
}

/**
 * Server Load: SSR query for initial Todos.
 * Renders static HTML on server before delivering to client.
 */
export async function fetchServerTodos(userId: string, authIdToken?: string | null): Promise<Todo[]> {
	const { db, isDemo } = await getServerFirebase(authIdToken);

	if (isDemo || !db) {
		return getDemoTodos(userId);
	}

	try {
		const todosRef = collection(db, 'todos');
		const q = query(
			todosRef,
			where('userId', '==', userId),
			orderBy('createdAt', 'desc')
		);
		const snapshot = await getDocs(q);
		return snapshot.docs.map((docSnap) => ({
			id: docSnap.id,
			...(docSnap.data() as Omit<Todo, 'id'>)
		}));
	} catch (err) {
		console.error('[fetchServerTodos] Firestore query error, returning fallback:', err);
		return getDemoTodos(userId);
	}
}

/**
 * Server Form Action: Create Todo
 */
export async function createServerTodo(
	todoData: { title: string; description?: string; priority: Priority; category: string },
	userId: string,
	authIdToken?: string | null
): Promise<Todo> {
	const { db, isDemo } = await getServerFirebase(authIdToken);

	const newTodo: Todo = {
		id: `todo-${Date.now()}`,
		title: todoData.title,
		description: todoData.description || '',
		completed: false,
		priority: todoData.priority,
		category: todoData.category || 'General',
		createdAt: Date.now(),
		userId
	};

	if (isDemo || !db) {
		const list = getDemoTodos(userId);
		list.unshift(newTodo);
		demoStore.set(userId, list);
		return newTodo;
	}

	try {
		const todosRef = collection(db, 'todos');
		const docRef = await addDoc(todosRef, {
			title: newTodo.title,
			description: newTodo.description,
			completed: newTodo.completed,
			priority: newTodo.priority,
			category: newTodo.category,
			createdAt: newTodo.createdAt,
			userId
		});
		return { ...newTodo, id: docRef.id };
	} catch (err) {
		console.error('[createServerTodo] Firestore addDoc failed, using local store:', err);
		const list = getDemoTodos(userId);
		list.unshift(newTodo);
		demoStore.set(userId, list);
		return newTodo;
	}
}

/**
 * Server Form Action: Toggle Completion
 */
export async function toggleServerTodo(
	todoId: string,
	completed: boolean,
	userId: string,
	authIdToken?: string | null
): Promise<void> {
	const { db, isDemo } = await getServerFirebase(authIdToken);

	if (isDemo || !db) {
		const list = getDemoTodos(userId);
		const item = list.find((t) => t.id === todoId);
		if (item) item.completed = completed;
		return;
	}

	try {
		const docRef = doc(db, 'todos', todoId);
		await updateDoc(docRef, { completed });
	} catch (err) {
		console.error('[toggleServerTodo] updateDoc failed:', err);
		const list = getDemoTodos(userId);
		const item = list.find((t) => t.id === todoId);
		if (item) item.completed = completed;
	}
}

/**
 * Server Form Action: Delete Todo
 */
export async function deleteServerTodo(
	todoId: string,
	userId: string,
	authIdToken?: string | null
): Promise<void> {
	const { db, isDemo } = await getServerFirebase(authIdToken);

	if (isDemo || !db) {
		const list = getDemoTodos(userId);
		const updated = list.filter((t) => t.id !== todoId);
		demoStore.set(userId, updated);
		return;
	}

	try {
		const docRef = doc(db, 'todos', todoId);
		await deleteDoc(docRef);
	} catch (err) {
		console.error('[deleteServerTodo] deleteDoc failed:', err);
		const list = getDemoTodos(userId);
		const updated = list.filter((t) => t.id !== todoId);
		demoStore.set(userId, updated);
	}
}
