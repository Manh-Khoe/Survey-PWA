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
// --- LOGIC ỨNG DỤNG: PWA, DB, GPS ---
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
window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
updateNetworkStatus();

document.getElementById('btn-location').addEventListener('click', () => {
    const locInput = document.getElementById('location-input');
    locInput.value = "Đang định vị...";
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => locInput.value = `${pos.coords.latitude}, ${pos.coords.longitude}`,
            () => { alert("Lỗi GPS!"); locInput.value = ""; },
            { enableHighAccuracy: true }
        );
    }
});

// ==========================================
// --- LOGIC XỬ LÝ NHIỀU ẢNH (CAMERA/GALLERY) ---
// ==========================================
let photosBase64 = []; // Mảng chứa các ảnh (có thể có nhiều ảnh)

// Hàm đọc file và render lên UI
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

// Lắng nghe sự kiện từ 2 nút (Chụp và Chọn)
document.getElementById('camera-input').addEventListener('change', e => {
    handleImageFiles(e.target.files);
    e.target.value = ''; // Reset để có thể bấm chụp tiếp
});

document.getElementById('gallery-input').addEventListener('change', e => {
    handleImageFiles(e.target.files);
    e.target.value = ''; // Reset
});

// Hàm vẽ danh sách ảnh (có nút xóa)
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

// Xóa 1 ảnh khỏi mảng
window.removePhoto = function(index) {
    photosBase64.splice(index, 1);
    renderPhotoGallery();
};


// ==========================================
// --- LƯU DỮ LIỆU & LỊCH SỬ ---
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
        photos: photosBase64, // Đổi thành mảng các ảnh
        timestamp: new Date().toLocaleString('vi-VN'),
        status: 'pending'
    };

    const db = await dbPromise;
    await db.add('sessions', data);
    
    if (Notification.permission === 'granted') {
        new Notification("Điều Tra Hiện Trường", { body: `Đã lưu phiên: ${data.topic}` });
    }
    
    alert("✅ Đã lưu phiếu khảo sát thành công!");
    
    // Reset Form
    e.target.reset();
    photosBase64 = [];
    renderPhotoGallery(); // Xóa sạch khung ảnh
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
        // Xử lý tạo HTML lưới ảnh cho lịch sử
        let photosHtml = '';
        if (session.photos && session.photos.length > 0) {
            photosHtml = `<div class="mt-3 grid grid-cols-3 gap-2">`;
            session.photos.forEach(imgData => {
                photosHtml += `<img src="${imgData}" class="aspect-square w-full object-cover rounded-lg border border-slate-200 shadow-sm">`;
            });
            photosHtml += `</div>`;
        }

        container.innerHTML += `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm relative">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="font-bold text-blue-700 text-sm pr-16">${session.topic}</h3>
                    <span class="absolute top-4 right-4 text-[9px] font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-md uppercase tracking-wide border border-orange-200">
                        Chờ đồng bộ
                    </span>
                </div>
                <p class="text-xs text-slate-600 mb-1"><b>Người hỏi:</b> ${session.interviewer} &nbsp;|&nbsp; <b>Người đáp:</b> ${session.interviewee}</p>
                <p class="text-xs text-slate-600 mb-1"><b>Phân loại:</b> ${session.type}</p>
                <p class="text-xs text-slate-600 mb-2 whitespace-pre-wrap"><b>Nội dung:</b> ${session.content}</p>
                <p class="text-xs text-slate-600 mb-2"><b>Tọa độ:</b> ${session.location || 'Chưa lấy GPS'}</p>
                <p class="text-[10px] text-slate-400 font-medium">🕒 ${session.timestamp}</p>
                
                ${photosHtml} <!-- Hiển thị khung chứa các ảnh ở đây -->
            </div>
        `;
    });
}

document.getElementById('btn-clear-db').addEventListener('click', async () => {
    if (confirm("⚠️ Bạn có chắc chắn muốn xóa toàn bộ dữ liệu khảo sát offline không?")) {
        const db = await dbPromise;
        await db.clear('sessions');
        alert("Đã xóa sạch dữ liệu!");
        loadHistory(); 
    }
});