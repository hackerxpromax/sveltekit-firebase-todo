#!/usr/bin/env node
import { execSync } from 'child_process';

console.log('🚀 === BẮT ĐẦU CÀI ĐẶT & DEPLOY TỰ ĐỘNG (1-CLICK) ===\n');

function run(cmd, desc) {
	console.log(`⏳ ${desc}...`);
	try {
		execSync(cmd, { stdio: 'inherit' });
		console.log(`✅ Hoàn thành: ${desc}\n`);
	} catch (err) {
		console.error(`❌ Lỗi khi thực hiện: ${desc}`);
		process.exit(1);
	}
}

try {
	// 1. Kiểm tra build
	run('npm run build', 'Build mã nguồn SvelteKit');

	// 2. Deploy lên Firebase Hosting
	run('npx -y firebase-tools@latest deploy --only hosting', 'Deploy lên Firebase Hosting');

	console.log('\n🎉 THÀNH CÔNG RỰC RỠ!');
	console.log('👉 Website của bạn đã hoạt động tại: https://planning-with-ai-57aa8.web.app\n');
	console.log('📌 HƯỚNG DẪN GẮN DOMAIN RIÊNG (Ví dụ: todo.tenban.com):');
	console.log('1. Mở: https://console.firebase.google.com/project/planning-with-ai-57aa8/hosting/sites');
	console.log('2. Bấm nút "Add custom domain" (Thêm miền tùy chỉnh)');
	console.log('3. Nhập domain của bạn và làm theo hướng dẫn trỏ bản ghi A/CNAME là xong!');
} catch (e) {
	console.error('Lỗi thiết lập:', e);
}
