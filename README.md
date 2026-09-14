# 📱 VKU Field Survey PWA

**Mini-Project 1: Offline-First Inspection Form**

Một ứng dụng Progressive Web App (PWA) được thiết kế chuyên biệt cho việc khảo sát hiện trường và kiểm tra cơ sở vật chất tại khuôn viên trường đại học. Điểm nổi bật của ứng dụng là khả năng hoạt động độc lập với kết nối mạng (Offline-first), tích hợp camera, định vị GPS và đồng bộ hóa tự động lên hệ sinh thái Google (Sheets & Drive).

🔗 **Live Demo:** [https://survey-pwa-dun.vercel.app/](https://survey-pwa-dun.vercel.app/)

---

## ✨ Tính năng nổi bật (Features)
*   **🔌 100% Offline-First:** Ứng dụng vẫn tải và hoạt động trơn tru ngay cả khi không có WiFi/4G nhờ bộ nhớ đệm của Service Worker.
*   **💾 Local Database:** Lưu trữ an toàn các phiên khảo sát (bao gồm dữ liệu văn bản và hình ảnh) trực tiếp trên trình duyệt thiết bị qua `IndexedDB`.
*   **☁️ Cloud Sync & Storage:** Tự động đồng bộ dữ liệu ngoại tuyến lên đám mây khi thiết bị có mạng trở lại. Ảnh hiện trường được tự động upload thành file trên Google Drive và trích xuất đường dẫn trực tiếp (URL) vào cơ sở dữ liệu Google Sheets.
*   **📍 Geolocation Tracking:** Tích hợp Web API để tự động lấy tọa độ GPS chính xác tại hiện trường khảo sát.
*   **📸 Multi-Photo Capture:** Hỗ trợ chụp ảnh trực tiếp từ camera hoặc chọn nhiều ảnh cùng lúc từ thư viện thiết bị.
*   **📱 Mobile-First UI:** Giao diện tối ưu hoàn toàn cho màn hình cảm ứng điện thoại với thanh điều hướng (Bottom Navigation), xây dựng bằng Tailwind CSS.

## 🛠️ Công nghệ sử dụng (Tech Stack)
*   **Frontend:** HTML5, Vanilla JavaScript, Tailwind CSS (qua CDN).
*   **Local Database:** IndexedDB (sử dụng thư viện `idb` tối ưu xử lý bất đồng bộ).
*   **PWA Core:** Service Worker (`sw.js`), Web App Manifest (`manifest.json`).
*   **Backend & Cloud:** Google Apps Script (Webhook API), Google Sheets, Google Drive.

## 🚀 Hướng dẫn cài đặt và Chạy thử (Local Development)

Do các tính năng PWA (Service Worker, Camera, GPS) yêu cầu môi trường bảo mật, dự án không thể chạy qua giao thức `file://` thông thường.

1. Clone kho lưu trữ này về máy:
   ```bash
   git clone [https://github.com/Manh-Khoe/Survey-PWA.git](https://github.com/Manh-Khoe/Survey-PWA.git)
   cd Survey-PWA
