# VKU Field Survey (Mini-Project 1)

> **Mô tả ngắn:** Ứng dụng PWA thu thập dữ liệu ngoại tuyến kết hợp Capacitor (Camera, Network) phục vụ thanh tra và kiểm toán viên sinh viên tại Đại học Công nghệ Thông tin & Truyền thông Việt - Hàn (VKU) nhằm kiểm toán cơ sở vật chất lớp học (máy chiếu, điều hòa, hệ thống điện, máy tính) tại các khu vực mất sóng (tầng hầm, phòng học xa).

---

## 🚀 Các Tính Năng Cốt Lõi

1. **PWA Standalone & Khởi động Ngoại tuyến:**
   - Cấu hình tệp `manifest.json` chuẩn (`display: standalone`, theme color `#0284c7`, bộ icon 192x192 và 512x512).
   - Tích hợp **Service Worker** lưu trữ bộ nhớ đệm (App Shell) với chiến lược **Cache-First**, khởi động ngoại tuyến dưới 1 giây.
   - Thư viện giao diện Tailwind CSS nạp cục bộ, đảm bảo hiển thị hoàn hảo ngay cả khi mở ứng dụng ở nơi không có mạng.

2. **Biểu Mẫu Ngoại Tuyến & Lưu Nháp Cục Bộ (Local Draft Persistence):**
   - Biểu mẫu kiểm toán toàn diện: Tòa nhà (*Building*), Tầng (*Floor*), Số phòng (*Room #*), Danh mục (*Hardware, Projector, AC, Electrical, Furniture*), Đánh giá tình trạng 1-5 sao ⭐, Ghi chú lỗi (*Defect Notes*), Tọa độ GPS và Ảnh chụp hiện trường.
   - Tự động lưu nháp liên tục theo thời gian thực vào **IndexedDB** (`VKUSurveyDB`) giúp ngăn chặn việc mất dữ liệu khi vô tình tải lại trình duyệt hoặc đóng ứng dụng.

3. **Hàng Đợi Ngoại Tuyến & Đồng Bộ Nền (Offline Queue & Background Sync):**
   - Mọi dữ liệu thu thập ngoại tuyến được gắn định danh **UUID**, dấu thời gian (*timestamp*) và lưu với trạng thái **`PENDING_SYNC`**.
   - Tự động kích hoạt hàng đợi và gửi tuần tự các phiếu lên máy chủ (Google Sheets Webhook) ngay khi thiết bị có kết nối mạng trở lại, chuyển trạng thái thành **`SYNCED`**.

4. **Biên Dịch Native App với Capacitor:**
   - **Camera Plugin (`@capacitor/camera`):** Ưu tiên kích hoạt máy ảnh vật lý gốc của điện thoại (`Camera.getPhoto`), tự động chuyển sang fallback web input khi chạy trên trình duyệt.
   - **Network Plugin (`@capacitor/network`):** Lắng nghe sự kiện thay đổi mạng phần cứng theo thời gian thực (`networkStatusChange`).

---

## 🛠️ Hướng Dẫn Cài Đặt & Chạy Ứng Dụng (Dành Cho Người Chấm)

### 1. Cài đặt các gói phụ thuộc (Dependencies)
Tại thư mục gốc của dự án, mở Terminal và chạy lệnh:
```bash
npm install
```

### 2. Xây dựng bản dựng Web (Frontend Build)
Gom và tối ưu hóa mã nguồn sang thư mục `dist/`:
```bash
npm run build
```

### 3. Khởi tạo môi trường Android Native với Capacitor
Tạo nền tảng Android và đồng bộ dữ liệu web cùng các native plugin:
```bash
npx cap add android
npx cap sync android
```

---

## 📱 Hướng Dẫn Xuất Tệp Android APK (app-release.apk)

### Cách 1: Sử dụng Gradle CLI (Không cần mở Android Studio)
1. Tạo file cấu hình `android/local.properties` chứa đường dẫn Android SDK:
   ```properties
   sdk.dir=C:/Users/ASUS/AppData/Local/Android/Sdk
   ```
   *(Thay đổi đường dẫn SDK phù hợp với máy của bạn, lưu ý dùng dấu gạch `/`)*.

2. Biên dịch APK trực tiếp bằng Gradle Wrapper:
   - **Trên Windows (PowerShell / Command Prompt):**
     ```powershell
     cd android
     .\gradlew.bat assembleRelease
     ```
   - **Trên macOS / Linux:**
     ```bash
     cd android
     ./gradlew assembleRelease
     ```
3. Sau khi xuất hiện thông báo `BUILD SUCCESSFUL`, tệp APK đã được tạo tại:
   ```text
   android/app/build/outputs/apk/release/app-release.apk
   ```

### Cách 2: Mở trong Android Studio
```bash
npx cap open android
```
Nhấn nút **Run** (mũi tên xanh) để cài lên máy ảo / thiết bị thật, hoặc chọn **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

---

## 📂 Cấu Trúc Dự Án

```text
├── public/                 # Tài nguyên tĩnh ngoại tuyến (icons, sw.js, manifest.json, tailwind.js)
├── index.html              # Giao diện chính ứng dụng kiểm toán
├── app.js                  # Logic ứng dụng, IndexedDB, Capacitor Camera & Network
├── sw.js                   # Service Worker Cache-First
├── manifest.json           # Cấu hình PWA Standalone
├── capacitor.config.json   # Cấu hình Capacitor
├── vite.config.js          # Cấu hình Vite bundler
├── build-apk.bat           # Script 1-click build APK tự động (Windows CMD)
├── build-apk.ps1           # Script 1-click build APK tự động (PowerShell)
├── package.json            # Scripts & danh sách dependencies
└── README.md               # Tài liệu hướng dẫn đồ án
```

