# Hướng Dẫn Tự Động Cho AI Coding Agent (Antigravity / Cursor / Claude)

Tài liệu này được thiết kế để bất kỳ AI Agent nào khi đọc dự án đều có thể hỗ trợ người dùng (người không chuyên kỹ thuật - non-tech) thiết lập và deploy trong 1 nốt nhạc.

---

## 🎯 Mục Tiêu
Giúp người dùng khởi chạy hoặc deploy ứng dụng Todo List SvelteKit + Firebase lên domain riêng với ít thao tác nhất.

---

## ⚡ Các Thao Tác Chuẩn Bị (Auto-Execution)

### 1. Khi người dùng nói "Chạy thử web" hoặc "Start app":
Agent chỉ cần chạy:
```bash
npm install
npm run dev -- --open
```

### 2. Khi người dùng nói "Deploy web" hoặc "Đưa lên mạng":
Agent thực hiện theo 2 bước:
1. **Kiểm tra đăng nhập Firebase:**
   ```bash
   npx -y firebase-tools@latest login
   ```
2. **Build và Deploy:**
   ```bash
   npm run deploy
   ```
3. Trả về cho người dùng liên kết web đang hoạt động (ví dụ: `https://planning-with-ai-57aa8.web.app`).

---

## 🌐 Hướng Dẫn Người Dùng Gắn Tên Miền Riêng (Custom Domain)
Khi người dùng muốn dùng tên miền riêng (ví dụ `todo.cuatoi.com`), Agent hướng dẫn họ:
1. Mở trang quản trị: [Firebase Hosting Console](https://console.firebase.google.com/project/planning-with-ai-57aa8/hosting/sites)
2. Bấm nút **"Add custom domain" (Thêm miền tùy chỉnh)**.
3. Điền tên miền của họ và thêm bản ghi DNS (A / CNAME) vào nhà cung cấp tên miền theo bảng Google hiển thị.
4. Google tự động cấp chứng chỉ bảo mật SSL miễn phí sau vài phút!
