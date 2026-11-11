# SvelteKit + Firebase Fullstack Todo App (PWA & Realtime)

Ứng dụng Todo List hoàn chỉnh hỗ trợ **Upload Ảnh**, **Đăng ký tài khoản mới**, **Offline PWA** và **Selective Realtime** trên nền tảng **Cloud Firestore + Firebase Hosting** (100% Miễn Phí vĩnh viễn trên gói Spark).

---

## ⚡ DÀNH CHO BẠN NON-TECH (DÙNG AGENT 1-CLICK)

Nếu bạn không rành kỹ thuật và vừa clone dự án này về:

### Cách 1: Kêu AI Agent làm hộ (Dễ nhất quả đất)
Chỉ cần copy câu lệnh này và dán cho AI Agent (Antigravity, Cursor, Claude Code, Gemini):
> *"Hãy giúp tôi đăng nhập Firebase và deploy trang web này lên mạng!"*

AI Agent sẽ tự động đọc file `AGENT.md` và làm từ A-Z cho bạn.

---

### Cách 2: Tự chạy bằng 2 dòng lệnh
Mở Terminal tại thư mục này và gõ:

```bash
# 1. Cài đặt các thư viện
npm install

# 2. Đăng nhập và đưa web lên mạng
npm run setup
```

Sau khi chạy xong, terminal sẽ in ra ngay đường link web trực tiếp của bạn (dạng: `https://...web.app`).

---

## 🌐 HƯỚNG DẪN GẮN TÊN MIỀN RIÊNG (Custom Domain)
Bạn có thể gắn tên miền của chính mình (ví dụ `todo.tenban.com`) hoàn toàn **miễn phí**:

1. Vào đường link quản trị: **[Firebase Hosting Console](https://console.firebase.google.com/project/planning-with-ai-57aa8/hosting/sites)**
2. Nhấp vào nút **"Add custom domain" (Thêm miền tùy chỉnh)**.
3. Nhập tên miền của bạn (ví dụ `todo.cuatoi.com`).
4. Google sẽ hiển thị 1 dòng cấu hình DNS (bản ghi A hoặc CNAME). Bạn chỉ cần copy dòng đó dán vào trang quản lý tên miền của bạn.
5. Google sẽ tự động kích hoạt bảo mật HTTPS/SSL trong 5 - 15 phút.

---

## 💻 CÁC LỆNH HỮU ÍCH
* `npm run dev`: Chạy thử giao diện trên máy tính (localhost).
* `npm run deploy`: Tự động build và cập nhật phiên bản mới lên trang web trực tuyến.
* `npm run deploy:rules`: Cập nhật quy tắc bảo mật Firestore Security Rules.
