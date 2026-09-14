# 📱 VKU Field Survey PWA

**Mini-Project 1: Offline-First Inspection Form**

Một ứng dụng Progressive Web App (PWA) được thiết kế chuyên biệt cho việc khảo sát hiện trường, kiểm tra cơ sở vật chất tại khuôn viên trường đại học. Điểm nổi bật của ứng dụng là khả năng hoạt động độc lập với kết nối mạng (Offline-first) với giao diện Mobile-First mượt mà.

## ✨ Tính năng nổi bật (Features)
*   **🔌 100% Offline-First:** Ứng dụng vẫn load và hoạt động bình thường ngay cả khi không có WiFi/4G nhờ Service Worker.
*   **💾 Local Database:** Lưu trữ an toàn các phiên khảo sát (bao gồm cả dữ liệu văn bản và hình ảnh Base64) trực tiếp trên trình duyệt qua `IndexedDB`.
*   **📍 Geolocation Tracking:** Tích hợp Web API để tự động lấy tọa độ GPS chính xác tại hiện trường.
*   **📸 Multi-Photo Capture:** Hỗ trợ chụp ảnh trực tiếp từ camera sau hoặc chọn nhiều ảnh từ thư viện thiết bị.
*   **📱 Mobile-First UI:** Giao diện tối ưu cho màn hình cảm ứng với thanh điều hướng (Bottom Navigation), xây dựng bằng Tailwind CSS.

## 🛠️ Công nghệ sử dụng (Tech Stack)
*   **Frontend:** HTML5, Vanilla JavaScript, Tailwind CSS (qua CDN).
*   **Database:** IndexedDB (sử dụng wrapper `idb` để tối ưu xử lý bất đồng bộ).
*   **PWA Core:** Service Worker (`sw.js`), Web App Manifest (`manifest.json`).

## 🚀 Hướng dẫn cài đặt và Chạy thử (Local Development)

Do các tính năng như Service Worker, Camera và GPS yêu cầu môi trường bảo mật, dự án không thể chạy qua giao thức `file://`.

1. Clone kho lưu trữ này về máy:
   ```bash
   git clone [https://github.com/your-username/vku-survey-pwa.git](https://github.com/your-username/vku-survey-pwa.git)
   cd vku-survey-pwa
