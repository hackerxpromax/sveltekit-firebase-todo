# SvelteKit + Firebase Fullstack Todo App

Ứng dụng Todo List Fullstack hoàn chỉnh áp dụng kiến trúc **Web-first · SSR-first · PWA** sử dụng **SvelteKit + Svelte 5 Runes** và **Firebase (Auth, Firestore, FirebaseServerApp, App Hosting)**.

---

## 1. Điểm Nhấn Kiến Trúc (Architecture Highlights)

```
User Request (Trình duyệt / PWA)
      │
      ▼
SvelteKit Server (+page.server.ts)
  ├── 1. FirebaseServerApp (Khởi tạo SSR với authIdToken lấy từ Cookie)
  ├── 2. Firebase Auth (Kiểm tra session và xác thực currentUser)
  └── 3. Firestore Query (Chạy query dưới quyền người dùng, tuân thủ Security Rules)
      │
      ▼
SSR HTML (Server-rendered HTML hoàn chỉnh kèm dữ liệu khởi tạo ban đầu)
      │
      ▼
Browser / PWA Client
  ├── 4. Svelte 5 Hydration (Gắn reactivity bằng Runes: $state, $derived, $effect)
  ├── 5. Progressive Enhancement (HTML Form Actions + use:enhance mượt mà không reload)
  └── 6. Selective Realtime (onSnapshot chỉ bật ở những vùng cần realtime để tiết kiệm chi phí)
```

### Phân biệt rõ hai loại Firebase SDK phía Server:
- **`FirebaseServerApp`**: Thao tác theo ngữ cảnh bảo mật của từng người dùng cụ thể (`authIdToken`). Đảm bảo Firestore Security Rules (`request.auth.uid == resource.data.userId`) được kiểm tra nghiêm ngặt. **Đây là chuẩn chính thức cho SSR.**
- **`Firebase Admin SDK`**: Mang quyền quản trị tối cao (bỏ qua mọi Security Rules). Tuyệt đối **không** dùng Admin SDK trong SSR để thay thế việc phân quyền người dùng và **không bao giờ** bundle vào client.

---

## 2. Công Nghệ Sử Dụng

| Tầng | Công nghệ | Chi tiết |
|---|---|---|
| **Frontend** | SvelteKit + Svelte 5 | Sử dụng Runes (`$state`, `$derived`, `$effect`, `$props`) |
| **Styling** | Tailwind CSS v4 | Dark mode hiện đại, giao diện thẻ card responsive |
| **Server** | SvelteKit Server Load & Actions | SSR ban đầu + Form Actions chuẩn HTTP POST |
| **Authentication** | Firebase Auth | Hỗ trợ Anonymous, Email/Password, duy trì qua SSR Cookie |
| **Database** | Cloud Firestore | NoSQL với `FirebaseServerApp` (SSR) & `onSnapshot` (Client) |
| **Offline & PWA** | Web App Manifest + Service Worker | Caching tài nguyên tĩnh, chạy offline mượt mà |
| **Deployment** | Firebase App Hosting | Node.js buildpack tự động phát hiện và build SvelteKit |

---

## 3. Quản Lý Chi Phí Realtime: "Selective Realtime"

Một nguyên tắc quan trọng trong thiết kế Firestore là **đừng bật realtime listener cho mọi dữ liệu**:
- **Mặc định (SSR + Form Actions):** Dữ liệu được fetch 1 lần lúc render trang. Các thao tác thêm, toggle, xóa được gửi qua Form Actions với `use:enhance` (optimistic UI update). Tiết kiệm tối đa số lượt đọc (reads) Firestore.
- **Chế độ Realtime:** Chỉ kích hoạt `onSnapshot` khi người dùng bật công tắc "Realtime Listener" hoặc trong các tác vụ hợp tác thời gian thực (collaboration). Có cơ chế tự động cleanup (`unsubscribe()`) khi component unmount hoặc khi tắt switch.

---

## 4. Ma Trận So Sánh: Firebase vs Supabase

| Tiêu chí | Firebase | Supabase |
|---|---|---|
| **Database Engine** | NoSQL (Firestore) / SQL Connect | PostgreSQL thuần |
| **Realtime** | Rất tốt (out-of-the-box, đồng bộ trực tiếp) | Rất tốt (qua Postgres CDC Replication) |
| **Offline Support** | Rất mạnh (hỗ trợ cache offline tự động) | Cần tự xây dựng thêm logic sync |
| **Authentication** | Rất tốt (Firebase Auth tích hợp SSR) | Rất tốt (Row Level Security qua JWT) |
| **Truy vấn phức tạp** | Hạn chế hơn với NoSQL | Rất mạnh (JOINs, Aggregate, SQL toàn diện) |
| **Hệ sinh thái Mobile** | Rất mạnh (FCM, Crashlytics, Remote Config) | Tốt |
| **SSR Support** | Chuẩn hóa qua `FirebaseServerApp` | Hỗ trợ qua `@supabase/ssr` |
| **Phù hợp nhất cho** | App realtime, chat, mobile-first, MVP nhanh | App nghiệp vụ, ERP, CRM, kế toán, SaaS đa quan hệ |

---

## 5. Hướng Dẫn Cài Đặt & Chạy Local

### Bước 1: Cài đặt dependencies
```bash
npm install
```

### Bước 2: Cấu hình Firebase (Tùy chọn)
Nếu chưa cấu hình, ứng dụng sẽ tự động chạy ở **Chế độ Demo In-Memory** đầy đủ tính năng để trải nghiệm ngay.

Để kết nối dự án Firebase thật của bạn, tạo file `.env`:
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-app
VITE_FIREBASE_STORAGE_BUCKET=your-app.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef
```

### Bước 3: Chạy môi trường phát triển
```bash
npm run dev -- --open
```

### Bước 4: Kiểm tra và Build Production
```bash
npm run check
npm run build
npm run preview
```

---

## 6. Hướng Dẫn Deploy lên Firebase App Hosting

Firebase App Hosting hỗ trợ trực tiếp các framework hiện đại như SvelteKit thông qua Node.js buildpack.

1. Đăng nhập Firebase CLI:
   ```bash
   firebase login
   ```
2. Khởi tạo App Hosting:
   ```bash
   firebase apphosting:backends:create --project your-project-id
   ```
3. File cấu hình `apphosting.yaml` đã được thiết lập sẵn trong dự án với cấu hình instance và memory tối ưu.
