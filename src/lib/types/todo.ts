export type Priority = 'low' | 'medium' | 'high';

export interface Todo {
	id: string;
	title: string;
	description?: string;
	completed: boolean;
	priority: Priority;
	category: string;
	createdAt: number;
	userId: string;
	imageUrl?: string;
}

export interface UserProfile {
	uid: string;
	email: string | null;
	displayName: string | null;
	isAnonymous: boolean;
	photoURL?: string | null;
}

export interface SSRPageData {
	initialTodos: Todo[];
	user: UserProfile | null;
	isRealtimeDefault: boolean;
	ssrRenderedAt: string;
	firebaseMode: 'real' | 'demo';
}
