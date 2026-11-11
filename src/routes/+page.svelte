<script lang="ts">
	import { onMount } from 'svelte';
	import type { Todo, Priority, UserProfile } from '$lib/types/todo';
	import {
		loginAnonymously,
		loginWithEmail,
		registerWithEmail,
		logout,
		subscribeToTodos,
		initAuthSync,
		fetchTodosClient,
		addTodoClient,
		toggleTodoClient,
		deleteTodoClient,
		uploadTodoImage
	} from '$lib/firebase/client';

	// Reactive state using Svelte 5 runes
	let todos = $state<Todo[]>([]);
	let user = $state<UserProfile | null>(null);
	let isLoading = $state(true);
	let realtimeEnabled = $state(false);

	let filter = $state<'all' | 'active' | 'completed' | 'high'>('all');
	let searchQuery = $state('');
	let selectedCategory = $state('All');

	// Form inputs
	let newTitle = $state('');
	let newDescription = $state('');
	let newPriority = $state<Priority>('medium');
	let newCategory = $state('General');
	let selectedImageFile = $state<File | null>(null);
	let imagePreviewUrl = $state<string | null>(null);
	let isSubmitting = $state(false);

	// Auth Modal state
	let showAuthModal = $state(false);
	let authMode = $state<'login' | 'register'>('login');
	let authEmail = $state('');
	let authPassword = $state('');
	let authConfirmPassword = $state('');
	let authDisplayName = $state('');
	let authError = $state<string | null>(null);
	let authSuccess = $state<string | null>(null);
	let isAuthenticating = $state(false);

	// Modal xem ảnh lớn
	let viewingImageUrl = $state<string | null>(null);

	let toastMessage = $state<string | null>(null);
	let toastTimer: any = null;

	function showToast(msg: string) {
		toastMessage = msg;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => {
			toastMessage = null;
		}, 3500);
	}

	async function loadTodos(uid: string) {
		isLoading = true;
		try {
			todos = await fetchTodosClient(uid);
		} catch (err) {
			console.error('Failed to load todos:', err);
		} finally {
			isLoading = false;
		}
	}

	function handleImageSelect(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files[0]) {
			const file = target.files[0];
			if (!file.type.startsWith('image/')) {
				showToast('Vui lòng chọn file hình ảnh (JPEG, PNG, WebP...)');
				return;
			}
			selectedImageFile = file;
			imagePreviewUrl = URL.createObjectURL(file);
		}
	}

	function removeSelectedImage() {
		selectedImageFile = null;
		if (imagePreviewUrl) {
			URL.revokeObjectURL(imagePreviewUrl);
			imagePreviewUrl = null;
		}
	}

	// Derived computations
	const categories = $derived([
		'All',
		...Array.from(new Set(todos.map((t) => t.category || 'General')))
	]);

	const filteredTodos = $derived(
		todos.filter((t) => {
			const matchesFilter =
				filter === 'all'
					? true
					: filter === 'active'
						? !t.completed
						: filter === 'completed'
							? t.completed
							: t.priority === 'high';

			const matchesCategory =
				selectedCategory === 'All' || (t.category || 'General') === selectedCategory;

			const matchesSearch =
				searchQuery.trim() === '' ||
				t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

			return matchesFilter && matchesCategory && matchesSearch;
		})
	);

	const stats = $derived({
		total: todos.length,
		completed: todos.filter((t) => t.completed).length,
		active: todos.filter((t) => !t.completed).length,
		highPriority: todos.filter((t) => t.priority === 'high' && !t.completed).length,
		progressPercent: todos.length ? Math.round((todos.filter((t) => t.completed).length / todos.length) * 100) : 0
	});

	// Manage Firestore Realtime onSnapshot listener
	$effect(() => {
		if (realtimeEnabled && user?.uid) {
			const unsubscribe = subscribeToTodos(
				user.uid,
				(updated: Todo[]) => {
					todos = updated;
					showToast('Đồng bộ Realtime Firestore thành công');
				},
				(err: Error) => {
					console.error('Realtime listener error:', err);
				}
			);

			return () => {
				unsubscribe();
			};
		}
	});

	onMount(() => {
		const cleanupAuth = initAuthSync((profile: UserProfile | null) => {
			user = profile;
			const effectiveUid = profile?.uid || 'guest';
			loadTodos(effectiveUid);
		});

		return () => {
			cleanupAuth();
		};
	});

	async function handleCreateTodo(e: Event) {
		e.preventDefault();
		if (!newTitle.trim()) return;

		isSubmitting = true;
		const effectiveUid = user?.uid || 'guest';

		try {
			let uploadedUrl = '';
			if (selectedImageFile) {
				uploadedUrl = await uploadTodoImage(selectedImageFile, effectiveUid);
			}

			const created = await addTodoClient(
				{
					title: newTitle.trim(),
					description: newDescription.trim(),
					priority: newPriority,
					category: newCategory,
					imageUrl: uploadedUrl
				},
				effectiveUid
			);

			if (!realtimeEnabled) {
				todos = [created, ...todos];
			}
			newTitle = '';
			newDescription = '';
			removeSelectedImage();
			showToast('Đã lưu công việc kèm ảnh vào Firestore!');
		} catch (err: any) {
			console.error(err);
			showToast('Lỗi khi lưu công việc');
		} finally {
			isSubmitting = false;
		}
	}

	async function handleToggleTodo(todo: Todo) {
		const targetState = !todo.completed;
		todo.completed = targetState; // Optimistic update
		const effectiveUid = user?.uid || 'guest';

		try {
			await toggleTodoClient(todo.id, targetState, effectiveUid);
		} catch (err) {
			console.error(err);
			todo.completed = !targetState; // Revert
		}
	}

	async function handleDeleteTodo(id: string) {
		const original = [...todos];
		todos = todos.filter((t) => t.id !== id); // Optimistic delete
		const effectiveUid = user?.uid || 'guest';

		try {
			await deleteTodoClient(id, effectiveUid);
			showToast('Đã xóa công việc');
		} catch (err) {
			console.error(err);
			todos = original; // Revert
			showToast('Xóa thất bại');
		}
	}

	async function handleAnonymousLogin() {
		try {
			authError = null;
			isAuthenticating = true;
			const loggedUser = await loginAnonymously();
			user = loggedUser;
			showAuthModal = false;
			showToast(`Đã đăng nhập: ${loggedUser.displayName}`);
			await loadTodos(loggedUser.uid);
		} catch (err: any) {
			authError = err.message || 'Đăng nhập ẩn danh thất bại';
		} finally {
			isAuthenticating = false;
		}
	}

	async function handleAuthSubmit(e: Event) {
		e.preventDefault();
		authError = null;
		authSuccess = null;

		if (!authEmail || !authPassword) {
			authError = 'Vui lòng điền đầy đủ email và mật khẩu';
			return;
		}

		if (authMode === 'register') {
			if (authPassword.length < 6) {
				authError = 'Mật khẩu phải có ít nhất 6 ký tự';
				return;
			}
			if (authPassword !== authConfirmPassword) {
				authError = 'Xác nhận mật khẩu không trùng khớp';
				return;
			}
		}

		isAuthenticating = true;
		try {
			if (authMode === 'register') {
				const loggedUser = await registerWithEmail(
					authEmail.trim(),
					authPassword,
					authDisplayName.trim() || undefined
				);
				user = loggedUser;
				showAuthModal = false;
				showToast(`Đăng ký thành công! Chào mừng ${loggedUser.displayName}`);
				await loadTodos(loggedUser.uid);
			} else {
				const loggedUser = await loginWithEmail(authEmail.trim(), authPassword);
				user = loggedUser;
				showAuthModal = false;
				showToast(`Chào mừng trở lại, ${loggedUser.displayName}!`);
				await loadTodos(loggedUser.uid);
			}
		} catch (err: any) {
			console.error('Auth error:', err);
			if (err.code === 'auth/email-already-in-use') {
				authError = 'Email này đã được sử dụng. Bạn hãy chuyển sang tab Đăng nhập.';
			} else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
				authError = 'Email hoặc mật khẩu không chính xác.';
			} else if (err.code === 'auth/operation-not-allowed') {
				authError = 'Phương thức Email/Password chưa được kích hoạt trong Firebase Console. (Authentication -> Sign-in method -> Email/Password).';
			} else if (err.code === 'auth/weak-password') {
				authError = 'Mật khẩu quá yếu (tối thiểu 6 ký tự).';
			} else {
				authError = err.message || 'Xác thực thất bại. Vui lòng thử lại.';
			}
		} finally {
			isAuthenticating = false;
		}
	}

	async function handleLogout() {
		await logout();
		user = null;
		showToast('Đã đăng xuất');
		await loadTodos('guest');
	}

	function getPriorityBadgeClass(p: Priority) {
		switch (p) {
			case 'high':
				return 'bg-red-500/15 text-red-400 border border-red-500/30';
			case 'medium':
				return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
			case 'low':
				return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
		}
	}
</script>

<!-- Top Notification Toast -->
{#if toastMessage}
	<div
		class="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900/95 border border-blue-500/40 text-blue-200 px-4 py-3 rounded-xl shadow-2xl backdrop-blur-md animate-bounce"
	>
		<span class="inline-block w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
		<span class="text-sm font-medium">{toastMessage}</span>
	</div>
{/if}

<!-- Header -->
<header class="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
	<div class="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
		<div class="flex items-center gap-3">
			<div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-lg shadow-orange-500/20 text-white font-bold text-xl">
				⚡
			</div>
			<div>
				<div class="flex items-center gap-2">
					<h1 class="font-bold text-lg text-white tracking-tight">SvelteKit + Firebase Todo</h1>
					<span class="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
						Free 100%
					</span>
					<span class="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 font-mono">
						Image Upload
					</span>
				</div>
				<p class="text-xs text-slate-400 flex items-center gap-2">
					<span>Project: <strong>planning-with-ai-57aa8</strong></span>
					<span>•</span>
					<span class="text-emerald-400 font-medium">Svelte 5 Runes</span>
				</p>
			</div>
		</div>

		<div class="flex items-center gap-3">
			<!-- Realtime Selective Toggle -->
			<div class="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg">
				<div class="flex flex-col text-right">
					<span class="text-[11px] font-semibold text-slate-200">Realtime Listener</span>
					<span class="text-[10px] text-slate-400">
						{realtimeEnabled ? 'onSnapshot Đang Chạy' : 'Tắt (Tiết Kiệm Đọc)'}
					</span>
				</div>
				<button
					type="button"
					role="switch"
					aria-label="Bật tắt realtime listener onSnapshot"
					aria-checked={realtimeEnabled}
					onclick={() => {
						realtimeEnabled = !realtimeEnabled;
						showToast(
							realtimeEnabled
								? 'Đã bật onSnapshot listener (realtime tức thời)'
								: 'Đã tắt realtime listener (tiết kiệm số lượt đọc Firestore)'
						);
					}}
					class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
						realtimeEnabled ? 'bg-emerald-500' : 'bg-slate-700'
					}`}
				>
					<span
						class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
							realtimeEnabled ? 'translate-x-6' : 'translate-x-1'
						}`}
					></span>
				</button>
			</div>

			<!-- User Auth Status -->
			{#if user}
				<div class="flex items-center gap-2 bg-slate-800/90 border border-slate-700 pl-3 pr-2 py-1.5 rounded-lg text-xs">
					<div class="flex flex-col text-right">
						<span class="text-slate-200 font-medium">{user.displayName}</span>
						<span class="text-[10px] text-slate-400">{user.isAnonymous ? 'Tài khoản ẩn danh' : user.email}</span>
					</div>
					<button
						onclick={handleLogout}
						class="p-1 text-slate-400 hover:text-red-400 transition-colors"
						title="Đăng xuất"
					>
						<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
						</svg>
					</button>
				</div>
			{:else}
				<button
					onclick={() => {
						authMode = 'login';
						showAuthModal = true;
					}}
					class="text-xs px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-md transition-colors flex items-center gap-1.5"
				>
					<span>Đăng Nhập / Đăng Ký</span>
				</button>
			{/if}
		</div>
	</div>
</header>

<!-- Main Container -->
<main class="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-6">
	<!-- Highlights Banner -->
	<section class="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
		<div class="absolute -right-10 -bottom-10 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"></div>
		<div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
			<div class="space-y-1">
				<div class="flex items-center gap-2">
					<span class="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
						Hỗ trợ Đăng Ký Mới & Tải Ảnh Lên
					</span>
					<span class="text-xs text-slate-400">Firebase Auth · Cloud Storage & Firestore Attachment</span>
				</div>
				<h2 class="text-lg font-bold text-white">Quản lý Công Việc Đa Phương Tiện & Xác Thực Người Dùng</h2>
				<p class="text-xs text-slate-300 max-w-2xl leading-relaxed">
					Bạn có thể <strong>Đăng ký tài khoản mới</strong> qua Email/Password, hoặc thử nhanh bằng <strong>Khách Ẩn Danh</strong>. Mỗi công việc hỗ trợ đính kèm hình ảnh minh họa (ảnh chụp màn hình, ảnh tài liệu) và lưu trữ an toàn.
				</p>
			</div>

			<div class="flex items-center gap-3 shrink-0">
				{#if !user}
					<button
						onclick={() => {
							authMode = 'register';
							showAuthModal = true;
						}}
						class="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg transition-all"
					>
						✨ Đăng Ký Tài Khoản Mới
					</button>
				{:else}
					<div class="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-center">
						<div class="text-[10px] text-slate-400 font-mono">Đang đăng nhập</div>
						<div class="text-xs font-bold text-emerald-400 truncate max-w-[150px]">
							{user.displayName}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</section>

	<!-- Dashboard Stats -->
	<section class="grid grid-cols-2 sm:grid-cols-4 gap-4">
		<div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
			<div class="text-xs text-slate-400 font-medium">Tổng Công Việc</div>
			<div class="text-2xl font-bold text-white mt-1">{stats.total}</div>
			<div class="text-[11px] text-slate-500 mt-0.5">Trong Firestore database</div>
		</div>
		<div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
			<div class="text-xs text-amber-400 font-medium">Đang Chờ Xử Lý</div>
			<div class="text-2xl font-bold text-amber-300 mt-1">{stats.active}</div>
			<div class="text-[11px] text-slate-500 mt-0.5">Cần hoàn thành</div>
		</div>
		<div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
			<div class="text-xs text-emerald-400 font-medium">Đã Hoàn Thành</div>
			<div class="text-2xl font-bold text-emerald-300 mt-1">{stats.completed}</div>
			<div class="text-[11px] text-slate-500 mt-0.5">Tỷ lệ: {stats.progressPercent}%</div>
		</div>
		<div class="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
			<div class="text-xs text-purple-400 font-medium">Có Ảnh Đính Kèm</div>
			<div class="text-2xl font-bold text-purple-300 mt-1">{todos.filter(t => Boolean(t.imageUrl)).length}</div>
			<div class="text-[11px] text-slate-500 mt-0.5">Task hình ảnh</div>
		</div>
	</section>

	<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
		<!-- Left: Form Tạo việc mới kèm Ảnh -->
		<div class="lg:col-span-1 space-y-4">
			<div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg">
				<div class="flex items-center justify-between mb-4">
					<h3 class="font-bold text-white text-base flex items-center gap-2">
						<span>➕</span> Thêm Việc & Upload Ảnh
					</h3>
					<span class="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 font-mono">
						Image Upload
					</span>
				</div>

				<form onsubmit={handleCreateTodo} class="space-y-4">
					<div>
						<label for="todo-title" class="block text-xs font-medium text-slate-300 mb-1">
							Tiêu đề công việc <span class="text-red-400">*</span>
						</label>
						<input
							id="todo-title"
							type="text"
							bind:value={newTitle}
							required
							placeholder="VD: Kiểm tra UI trên điện thoại..."
							class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
						/>
					</div>

					<div>
						<label for="todo-desc" class="block text-xs font-medium text-slate-300 mb-1">
							Ghi chú / Mô tả chi tiết
						</label>
						<textarea
							id="todo-desc"
							rows="2"
							bind:value={newDescription}
							placeholder="Mô tả các bước thực hiện..."
							class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
						></textarea>
					</div>

					<!-- Image Upload Field -->
					<div>
						<span class="block text-xs font-medium text-slate-300 mb-1">
							Đính kèm hình ảnh (Upload)
						</span>

						{#if imagePreviewUrl}
							<div class="relative rounded-xl overflow-hidden border border-purple-500/40 bg-slate-950 p-2 flex items-center gap-3">
								<img src={imagePreviewUrl} alt="Preview" class="w-16 h-16 object-cover rounded-lg border border-slate-800" />
								<div class="flex-1 min-w-0 text-xs">
									<div class="text-slate-200 font-medium truncate">{selectedImageFile?.name}</div>
									<div class="text-[10px] text-slate-500 mt-0.5">
										{selectedImageFile ? Math.round(selectedImageFile.size / 1024) + ' KB' : ''}
									</div>
								</div>
								<button
									type="button"
									onclick={removeSelectedImage}
									class="p-1.5 text-slate-400 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800"
									title="Gỡ ảnh"
								>
									✕
								</button>
							</div>
						{:else}
							<label class="border-2 border-dashed border-slate-700 hover:border-purple-500/70 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/50 hover:bg-purple-500/5">
								<input type="file" accept="image/*" onchange={handleImageSelect} class="hidden" />
								<svg class="w-6 h-6 text-purple-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
								</svg>
								<span class="text-xs text-slate-300 font-medium">Bấm để chọn ảnh đính kèm</span>
								<span class="text-[10px] text-slate-500 mt-0.5">PNG, JPG, WebP tự động nén tối ưu</span>
							</label>
						{/if}
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="todo-priority" class="block text-xs font-medium text-slate-300 mb-1">Mức ưu tiên</label>
							<select
								id="todo-priority"
								bind:value={newPriority}
								class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
							>
								<option value="low">Thấp (Low)</option>
								<option value="medium">Trung bình</option>
								<option value="high">Cao (High)</option>
							</select>
						</div>

						<div>
							<label for="todo-category" class="block text-xs font-medium text-slate-300 mb-1">Nhóm / Danh mục</label>
							<select
								id="todo-category"
								bind:value={newCategory}
								class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
							>
								<option value="Architecture">Architecture</option>
								<option value="Frontend">Frontend</option>
								<option value="Backend">Backend</option>
								<option value="Performance">Performance</option>
								<option value="DevOps">DevOps</option>
								<option value="General">General</option>
							</select>
						</div>
					</div>

					<button
						type="submit"
						disabled={isSubmitting || !newTitle.trim()}
						class="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
					>
						{#if isSubmitting}
							<span class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
							<span>Đang xử lý & tải lên...</span>
						{:else}
							<span>Lưu công việc</span>
						{/if}
					</button>
				</form>
			</div>
		</div>

		<!-- Right: Danh sách Todo có Ảnh đính kèm -->
		<div class="lg:col-span-2 space-y-4">
			<!-- Filters & Search Toolbar -->
			<div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
				<!-- Status Filters -->
				<div class="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
					<button
						onclick={() => (filter = 'all')}
						class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all {filter === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}"
					>
						Tất cả ({todos.length})
					</button>
					<button
						onclick={() => (filter = 'active')}
						class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all {filter === 'active' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}"
					>
						Đang làm ({stats.active})
					</button>
					<button
						onclick={() => (filter = 'completed')}
						class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all {filter === 'completed' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}"
					>
						Đã xong ({stats.completed})
					</button>
					<button
						onclick={() => (filter = 'high')}
						class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all {filter === 'high' ? 'bg-red-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}"
					>
						Gấp
					</button>
				</div>

				<!-- Search Input -->
				<div class="relative flex-1 sm:max-w-xs">
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Tìm kiếm công việc..."
						class="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
					/>
					<svg class="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
					</svg>
				</div>
			</div>

			<!-- Category Tabs -->
			<div class="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
				{#each categories as cat}
					<button
						onclick={() => (selectedCategory = cat)}
						class="px-3 py-1 rounded-full border transition-colors whitespace-nowrap {selectedCategory === cat ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 font-medium' : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'}"
					>
						{cat}
					</button>
				{/each}
			</div>

			<!-- List Items -->
			<div class="space-y-3">
				{#if isLoading}
					<div class="bg-slate-900/40 border border-slate-800 rounded-2xl p-12 text-center text-xs text-slate-400 space-y-2">
						<div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
						<div>Đang tải dữ liệu từ Firestore...</div>
					</div>
				{:else if filteredTodos.length === 0}
					<div class="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-12 text-center space-y-3">
						<div class="text-4xl">📋</div>
						<div class="text-slate-300 font-medium text-sm">Không tìm thấy công việc nào phù hợp</div>
						<p class="text-xs text-slate-500 max-w-sm mx-auto">
							Hãy thử thay đổi bộ lọc hoặc thêm một công việc mới kèm hình ảnh bằng form bên trái.
						</p>
					</div>
				{:else}
					{#each filteredTodos as todo (todo.id)}
						<div
							class="group bg-slate-900/70 hover:bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all duration-200 shadow-sm flex items-start gap-3.5"
						>
							<!-- Checkbox Toggle -->
							<button
								type="button"
								onclick={() => handleToggleTodo(todo)}
								aria-label="Đánh dấu trạng thái công việc"
								class="mt-1 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors {todo.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600 bg-slate-950 hover:border-slate-400'}"
							>
								{#if todo.completed}
									<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
									</svg>
								{/if}
							</button>

							<!-- Content -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 flex-wrap">
									<h4
										class="text-sm font-semibold tracking-tight transition-all {todo.completed ? 'line-through text-slate-500' : 'text-slate-100'}"
									>
										{todo.title}
									</h4>
									<span class="text-[10px] px-2 py-0.5 rounded-full font-medium {getPriorityBadgeClass(todo.priority)}">
										{todo.priority.toUpperCase()}
									</span>
									<span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60 font-mono">
										{todo.category || 'General'}
									</span>
								</div>

								{#if todo.description}
									<p class="text-xs text-slate-400 mt-1 leading-relaxed">
										{todo.description}
									</p>
								{/if}

								<!-- Thumbnail ảnh đính kèm (nếu có) -->
								{#if todo.imageUrl}
									<div class="mt-2.5">
										<button
											type="button"
											onclick={() => (viewingImageUrl = todo.imageUrl!)}
											class="group/img relative inline-block rounded-xl overflow-hidden border border-slate-700 hover:border-purple-400 transition-all shadow-md"
										>
											<img src={todo.imageUrl} alt="Đính kèm" class="h-24 w-auto max-w-[200px] object-cover rounded-xl transition-transform group-hover/img:scale-105" />
											<div class="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-medium gap-1">
												<span>🔍 Phóng to</span>
											</div>
										</button>
									</div>
								{/if}

								<div class="flex items-center gap-3 text-[11px] text-slate-500 mt-2">
									<span>ID: {todo.id.substring(0, 8)}...</span>
									<span>•</span>
									<span>Tạo: {new Date(todo.createdAt).toLocaleTimeString('vi-VN')}</span>
								</div>
							</div>

							<!-- Delete Button -->
							<button
								type="button"
								onclick={() => handleDeleteTodo(todo.id)}
								class="opacity-40 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
								title="Xóa công việc"
								aria-label="Xóa công việc"
							>
								<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</main>

<!-- Modal Xem Ảnh Phóng To -->
{#if viewingImageUrl}
	<div class="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
		<div class="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
			<button
				onclick={() => (viewingImageUrl = null)}
				class="absolute -top-10 right-0 text-white/80 hover:text-white text-sm bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700"
			>
				Đóng ✕
			</button>
			<img src={viewingImageUrl} alt="Full view" class="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-slate-800" />
		</div>
	</div>
{/if}

<!-- Auth Modal (Hỗ trợ Đăng Nhập & Đăng Ký New User) -->
{#if showAuthModal}
	<div class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
		<div class="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
			<button
				onclick={() => (showAuthModal = false)}
				class="absolute right-5 top-5 text-slate-400 hover:text-white"
			>
				✕
			</button>

			<div class="space-y-1">
				<h3 class="text-lg font-bold text-white">Xác Thực Tài Khoản</h3>
				<p class="text-xs text-slate-400">
					Dữ liệu công việc & hình ảnh của bạn sẽ được lưu trữ riêng biệt trên Cloud Firestore.
				</p>
			</div>

			<!-- Tab switcher: Đăng nhập vs Đăng ký mới -->
			<div class="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
				<button
					type="button"
					onclick={() => {
						authMode = 'login';
						authError = null;
					}}
					class="flex-1 py-2 rounded-lg font-semibold transition-all {authMode === 'login' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}"
				>
					Đăng Nhập
				</button>
				<button
					type="button"
					onclick={() => {
						authMode = 'register';
						authError = null;
					}}
					class="flex-1 py-2 rounded-lg font-semibold transition-all {authMode === 'register' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}"
				>
					✨ Đăng Ký Mới
				</button>
			</div>

			{#if authError}
				<div class="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl leading-relaxed">
					{authError}
				</div>
			{/if}

			<form onsubmit={handleAuthSubmit} class="space-y-3">
				{#if authMode === 'register'}
					<div>
						<label for="auth-name-input" class="block text-xs text-slate-300 mb-1">Tên hiển thị (Tùy chọn)</label>
						<input
							id="auth-name-input"
							type="text"
							bind:value={authDisplayName}
							placeholder="VD: Tony Nguyễn"
							class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
						/>
					</div>
				{/if}

				<div>
					<label for="auth-email-input" class="block text-xs text-slate-300 mb-1">Email <span class="text-red-400">*</span></label>
					<input
						id="auth-email-input"
						type="email"
						required
						bind:value={authEmail}
						placeholder="user@example.com"
						class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
					/>
				</div>

				<div>
					<label for="auth-password-input" class="block text-xs text-slate-300 mb-1">Mật khẩu <span class="text-red-400">*</span></label>
					<input
						id="auth-password-input"
						type="password"
						required
						bind:value={authPassword}
						placeholder="Tối thiểu 6 ký tự"
						class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
					/>
				</div>

				{#if authMode === 'register'}
					<div>
						<label for="auth-confirm-password" class="block text-xs text-slate-300 mb-1">Xác nhận mật khẩu <span class="text-red-400">*</span></label>
						<input
							id="auth-confirm-password"
							type="password"
							required
							bind:value={authConfirmPassword}
							placeholder="Nhập lại mật khẩu"
							class="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
						/>
					</div>
				{/if}

				<button
					type="submit"
					disabled={isAuthenticating}
					class="w-full mt-2 py-2.5 px-4 rounded-xl text-white font-medium text-xs transition-all shadow-lg flex items-center justify-center gap-2 {authMode === 'register' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'}"
				>
					{#if isAuthenticating}
						<span class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
						<span>Đang xử lý...</span>
					{:else}
						<span>{authMode === 'register' ? 'Tạo Tài Khoản Mới' : 'Đăng Nhập'}</span>
					{/if}
				</button>
			</form>

			<div class="relative flex items-center justify-center my-2">
				<div class="border-t border-slate-800 w-full"></div>
				<span class="bg-slate-900 px-3 text-[11px] text-slate-500 uppercase">Hoặc</span>
			</div>

			<button
				type="button"
				onclick={handleAnonymousLogin}
				disabled={isAuthenticating}
				class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-medium text-xs shadow-lg transition-all"
			>
				⚡ Dùng Thử Ẩn Danh Không Cần Đăng Ký
			</button>
		</div>
	</div>
{/if}
