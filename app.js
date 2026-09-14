// ==========================================
// --- CẤU HÌNH HỆ THỐNG ---
// ==========================================
const DEFAULT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxpFdt4m00x3yIp-dfWqiKwGzyPyFgzfAyX4EWwQGU4PbEbU2sx5dcxwAwE4_SUQCdr/exec";

// Tự động điền Webhook URL vào ô cài đặt khi load trang
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('webhook-url').value = DEFAULT_WEBHOOK_URL;
});

// ==========================================
// --- LOGIC GIAO DIỆN: CHUYỂN TAB MOBILE ---
// ==========================================
function switchTab(tabId, title) {
    document.getElementById('header-title').textContent = title;

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('block');
        tab.classList.add('hidden');
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-blue-600');
        btn.classList.add('text-slate-400');
    });

    document.getElementById(`tab-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-${tabId}`).classList.add('block');
    document.getElementById(`nav-${tabId}`).classList.remove('text-slate-400');
    document.getElementById(`nav-${tabId}`).classList.add('text-blue-600');

    if (tabId === 'history') loadHistory();
}

// ==========================================
// --- LOGIC ỨNG DỤNG: PWA & DATABASE ---
// ==========================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.error(err));
}

let dbPromise;
async function initDB() {
    dbPromise = idb.openDB('VKUSurveyDB', 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('sessions')) {
                db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
            }
        },
    });
}
initDB();

// Cập nhật trạng thái mạng Online/Offline
function updateNetworkStatus() {
    const badge = document.getElementById('network-status');
    if (navigator.onLine) {
        badge.textContent = 'ONLINE';
        badge.className = 'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-700';
    } else {
        badge.textContent = 'OFFLINE';
        badge.className = 'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-red-100 text-red-700';
    }
}
window.addEventListener('online', () => {
    updateNetworkStatus();
    syncPendingData(); // Có mạng lại thì tự động gọi hàm đồng bộ
});
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();

// ==========================================
// --- LOGIC GPS VÀ TỌA ĐỘ ---
// ==========================================
document.getElementById('btn-location').addEventListener('click', () => {
    const locInput = document.getElementById('location-input');
    locInput.value = "Đang định vị...";
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => locInput.value = `${pos.coords.latitude}, ${pos.coords.longitude}`,
            () => { alert("Lỗi GPS! Vui lòng cấp quyền truy cập vị trí."); locInput.value = ""; },
            { enableHighAccuracy: true }
        );
    }
});

// ==========================================
// --- LOGIC XỬ LÝ NHIỀU ẢNH (CAMERA/GALLERY) ---
// ==========================================
let photosBase64 = []; 

function handleImageFiles(files) {
    Array.from(files).forEach(file => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = ev => {
                photosBase64.push(ev.target.result);
                renderPhotoGallery();
            };
            reader.readAsDataURL(file);
        }
    });
}

document.getElementById('camera-input').addEventListener('change', e => {
    handleImageFiles(e.target.files);
    e.target.value = ''; 
});

document.getElementById('gallery-input').addEventListener('change', e => {
    handleImageFiles(e.target.files);
    e.target.value = ''; 
});

function renderPhotoGallery() {
    const gallery = document.getElementById('photo-gallery');
    if (photosBase64.length === 0) {
        gallery.classList.add('hidden');
        gallery.innerHTML = '';
        return;
    }
    
    gallery.classList.remove('hidden');
    gallery.innerHTML = '';
    
    photosBase64.forEach((base64, index) => {
        const div = document.createElement('div');
        div.className = 'relative aspect-square rounded-xl border border-slate-200 overflow-hidden shadow-sm';
        div.innerHTML = `
            <img src="${base64}" class="w-full h-full object-cover">
            <button type="button" onclick="removePhoto(${index})" class="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-500 shadow">✕</button>
        `;
        gallery.appendChild(div);
    });
}

window.removePhoto = function(index) {
    photosBase64.splice(index, 1);
    renderPhotoGallery();
};

// ==========================================
// --- ĐỒNG BỘ GOOGLE SHEETS (API CALL) ---
// ==========================================
async function sendToGoogleSheets(data) {
    const webhookUrl = document.getElementById('webhook-url').value;
    if (!webhookUrl) throw new Error("Chưa có Webhook URL");

    // Lần này chúng ta KHÔNG xóa data.photos nữa, gửi nguyên cả mảng ảnh (Base64) lên server
    const payload = { ...data };

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        return true;
    } catch (err) {
        throw err;
    }
}

async function syncPendingData() {
    const db = await dbPromise;
    const sessions = await db.getAll('sessions');
    const pendingSessions = sessions.filter(s => s.status === 'pending');

    if (pendingSessions.length === 0) return;

    let successCount = 0;
    for (let session of pendingSessions) {
        try {
            await sendToGoogleSheets(session);
            session.status = 'synced';
            await db.put('sessions', session);
            successCount++;
        } catch (error) {
            console.error("Lỗi đồng bộ: ", error);
        }
    }
    
    if (successCount > 0) {
        loadHistory();
        if (Notification.permission === 'granted') {
            new Notification("VKU Survey", { body: `Đã đồng bộ ${successCount} phiếu lên mây!` });
        }
    }
}

// ==========================================
// --- LƯU FORM VÀ LỊCH SỬ ---
// ==========================================
document.getElementById('interview-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const data = {
        interviewer: document.getElementById('interviewer-name').value,
        interviewee: document.getElementById('interviewee-name').value,
        type: document.getElementById('interview-type').value,
        topic: document.getElementById('interview-topic').value,
        content: document.getElementById('interview-content').value,
        location: document.getElementById('location-input').value,
        photos: photosBase64, 
        timestamp: new Date().toLocaleString('vi-VN'),
        status: 'pending' 
    };

    const db = await dbPromise;

    if (navigator.onLine && document.getElementById('webhook-url').value) {
        try {
            await sendToGoogleSheets(data);
            data.status = 'synced'; 
            alert("✅ Đã lưu và đồng bộ trực tiếp lên Google Sheets!");
        } catch (error) {
            alert("⚠️ Lỗi mạng. Dữ liệu đã được lưu offline!");
        }
    } else {
        alert("💾 Đang Offline. Dữ liệu đã được lưu vào bộ nhớ máy!");
    }

    // 1. Lưu vào DB
    await db.add('sessions', data);
    
    // 2. Xóa trắng form thủ công để chống kẹt lỗi
    document.getElementById('interview-form').reset();
    document.getElementById('location-input').value = '';
    photosBase64 = [];
    renderPhotoGallery();
    loadHistory(); // Cập nhật lại list lịch sử

    // 3. Xử lý thông báo (bọc trong try-catch để không bị crash nếu thiết bị chặn)
    try {
        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    } catch (err) { console.log("Thông báo bị chặn", err); }
});


// ==========================================
// --- LOAD LỊCH SỬ VÀ XEM CHI TIẾT (MODAL) ---
// ==========================================
async function loadHistory() {
    const db = await dbPromise;
    const sessions = await db.getAll('sessions');
    const container = document.getElementById('session-history');
    
    if (sessions.length === 0) {
        container.innerHTML = `<div class="text-center p-6 text-slate-400 text-sm">Chưa có dữ liệu khảo sát.</div>`;
        return;
    }

    container.innerHTML = '';
    
    sessions.reverse().forEach(session => {
        // Lấy 1 ảnh đầu tiên làm thumbnail nhỏ (nếu có)
        let thumbHtml = '';
        if (session.photos && session.photos.length > 0) {
            thumbHtml = `<img src="${session.photos[0]}" class="mt-2 h-16 w-16 object-cover rounded-lg border border-slate-200">`;
        }

        const statusLabel = session.status === 'synced' 
            ? `<span class="absolute top-3 right-3 text-[9px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded">Đồng bộ ✓</span>`
            : `<span class="absolute top-3 right-3 text-[9px] font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded">Chờ ⏳</span>`;

        // Thêm sự kiện onclick để mở Modal, và lớp cursor-pointer
        container.innerHTML += `
            <div onclick="openModal(${session.id})" class="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm relative mb-3 cursor-pointer hover:bg-slate-100 active:scale-[0.98] transition-all">
                <h3 class="font-bold text-blue-700 text-sm pr-16 truncate">${session.topic}</h3>
                ${statusLabel}
                <p class="text-xs text-slate-600 mt-1"><b>Chủ đề:</b> ${session.type}</p>
                <p class="text-xs text-slate-500 mt-1 truncate"><b>Nội dung:</b> ${session.content}</p>
                ${thumbHtml}
                <p class="text-[10px] text-slate-400 font-medium mt-2">🕒 ${session.timestamp}</p>
            </div>
        `;
    });
}

// Logic mở popup chi tiết
window.openModal = async function(id) {
    const db = await dbPromise;
    const session = await db.get('sessions', id);
    if (!session) return;

    // Load tất cả các ảnh vào dạng lưới lớn
    let photosHtml = '';
    if (session.photos && session.photos.length > 0) {
        photosHtml = `<div class="grid grid-cols-1 gap-3 mt-4 pt-4 border-t">`;
        session.photos.forEach(img => {
            photosHtml += `<img src="${img}" class="w-full object-contain rounded-lg border border-slate-200 shadow-sm">`;
        });
        photosHtml += `</div>`;
    }

    // Nhồi dữ liệu vào Modal
    document.getElementById('modal-content').innerHTML = `
        <p><b>Người hỏi:</b> ${session.interviewer}</p>
        <p><b>Người đáp:</b> ${session.interviewee}</p>
        <p><b>Phân loại:</b> <span class="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">${session.type}</span></p>
        <p><b>Chủ đề:</b> ${session.topic}</p>
        <div class="bg-slate-100 p-3 rounded-lg my-2 whitespace-pre-wrap">${session.content}</div>
        <p class="text-xs text-slate-500">📍 ${session.location || 'Chưa lấy GPS'}</p>
        <p class="text-xs text-slate-500">🕒 ${session.timestamp}</p>
        ${photosHtml}
    `;

    // Hiển thị Modal
    const modal = document.getElementById('detail-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    // Delay nhỏ để CSS transition opacity hoạt động
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
};

// Logic đóng popup
window.closeModal = function() {
    const modal = document.getElementById('detail-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 300); // Đợi CSS transition mờ đi xong thì mới ẩn hẳn
};

// ==========================================
// --- CÀI ĐẶT ---
// ==========================================
document.getElementById('btn-clear-db').addEventListener('click', async () => {
    if (confirm("⚠️ Xóa toàn bộ dữ liệu offline? Hành động này không thể hoàn tác.")) {
        const db = await dbPromise;
        await db.clear('sessions');
        alert("Đã dọn dẹp bộ nhớ thiết bị!");
        loadHistory(); 
    }
});
