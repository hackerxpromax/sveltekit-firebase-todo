<script lang="ts">
	import './layout.css';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<div class="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans">
	{@render children()}
</div>
