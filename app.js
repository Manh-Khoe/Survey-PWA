// ==========================================
// --- CẤU HÌNH HỆ THỐNG ---
// ==========================================
const DEFAULT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwkkbtF3V_NpYZJ74ka3S272Xs9izEsE_7LJWxTNlHpA0EX9QkrL_lrKrKCLOrigYJQ/exec";

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

    // Lọc bỏ base64 ảnh trước khi gửi để tránh đầy bộ nhớ Sheet (ảnh vẫn giữ ở local)
    const payload = { ...data };
    delete payload.photos; 

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors', // Sử dụng no-cors để tránh lỗi Preflight với Google Apps Script
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
        status: 'pending' // Mặc định là chờ đồng bộ
    };

    const db = await dbPromise;

    if (navigator.onLine && document.getElementById('webhook-url').value) {
        try {
            await sendToGoogleSheets(data);
            data.status = 'synced'; // Đồng bộ thành công
            alert("✅ Đã lưu và đồng bộ trực tiếp lên Google Sheets!");
        } catch (error) {
            alert("⚠️ Mạng chập chờn. Dữ liệu đã được lưu offline!");
        }
    } else {
        alert("💾 Đang Offline. Dữ liệu đã được lưu vào bộ nhớ máy!");
    }

    await db.add('sessions', data);
    
    // Yêu cầu quyền thông báo nếu chưa có
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
    
    e.target.reset();
    photosBase64 = [];
    renderPhotoGallery();
    loadHistory();
});

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
        let photosHtml = '';
        if (session.photos && session.photos.length > 0) {
            photosHtml = `<div class="mt-3 grid grid-cols-3 gap-2">`;
            session.photos.forEach(imgData => {
                photosHtml += `<img src="${imgData}" class="aspect-square w-full object-cover rounded-lg border border-slate-200 shadow-sm">`;
            });
            photosHtml += `</div>`;
        }

        const statusLabel = session.status === 'synced' 
            ? `<span class="absolute top-4 right-4 text-[9px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-md uppercase tracking-wide border border-green-200">Đã đồng bộ ✓</span>`
            : `<span class="absolute top-4 right-4 text-[9px] font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-md uppercase tracking-wide border border-orange-200">Chờ đồng bộ ⏳</span>`;

        container.innerHTML += `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm relative mb-3">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-blue-700 text-sm pr-20">${session.topic}</h3>
                    ${statusLabel}
                </div>
                <p class="text-xs text-slate-600 mb-1"><b>Người hỏi:</b> ${session.interviewer} &nbsp;|&nbsp; <b>Người đáp:</b> ${session.interviewee}</p>
                <p class="text-xs text-slate-600 mb-1"><b>Phân loại:</b> ${session.type}</p>
                <p class="text-xs text-slate-600 mb-2 whitespace-pre-wrap"><b>Nội dung:</b> ${session.content}</p>
                <p class="text-[10px] text-slate-400 font-medium">📍 ${session.location || 'Chưa lấy GPS'} <br> 🕒 ${session.timestamp}</p>
                ${photosHtml}
            </div>
        `;
    });
}

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
