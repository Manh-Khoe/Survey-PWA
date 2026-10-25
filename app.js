import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Network } from '@capacitor/network';
import { openDB } from 'idb';

// ==========================================
// --- CẤU HÌNH HỆ THỐNG & DEFAULTS ---
// ==========================================
const DEFAULT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzrv-Vd0AGeh-PjmBdEaPynOnOERPv0QYx951VlaBqW-GXxJ3N7BviRHeZp8u9vmuUz/exec";
const DB_NAME = 'VKUSurveyDB';
const DB_VERSION = 2;

let dbPromise;
let isSyncing = false;
let currentFilter = 'all';
let photosBase64 = [];

// ==========================================
// --- KHỞI TẠO CƠ SỞ DỮ LIỆU INDEXEDDB ---
// ==========================================
async function initDB() {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion) {
            // Store cho phiếu khảo sát
            if (!db.objectStoreNames.contains('surveys')) {
                const store = db.createObjectStore('surveys', { keyPath: 'id' });
                store.createIndex('status', 'status');
                store.createIndex('timestamp', 'timestamp');
            }
            // Store cho bản nháp form (Local Draft Persistence)
            if (!db.objectStoreNames.contains('drafts')) {
                db.createObjectStore('drafts', { keyPath: 'key' });
            }
            // Giữ lại dữ liệu cũ từ mini session nếu có nâng cấp
            if (oldVersion < 2 && db.objectStoreNames.contains('sessions')) {
                // Tự động tương thích
            }
        },
    });
    return dbPromise;
}

// ==========================================
// --- GIAO DIỆN: CHUYỂN TAB MOBILE ---
// ==========================================
function switchTab(tabId, title) {
    document.getElementById('header-title').textContent = title;

    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('block');
        tab.classList.add('hidden');
    });

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-sky-600');
        btn.classList.add('text-slate-400');
    });

    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) {
        targetTab.classList.remove('hidden');
        targetTab.classList.add('block');
    }

    const targetBtn = document.getElementById(`nav-${tabId}`);
    if (targetBtn) {
        targetBtn.classList.remove('text-slate-400');
        targetBtn.classList.add('text-sky-600');
    }

    if (tabId === 'history') loadHistory();
    if (tabId === 'settings') updateEnvSettings();
}

// ==========================================
// --- ĐÁNH GIÁ 1-5 SAO (CONDITION RATING) ---
// ==========================================
const ratingDescriptions = {
    1: '1/5 - Hỏng nặng / Ngưng hoạt động',
    2: '2/5 - Kém / Nhiều lỗi cần sửa gấp',
    3: '3/5 - Bình thường / Cần bảo trì',
    4: '4/5 - Khá tốt / Lỗi thẩm mỹ nhỏ',
    5: '5/5 - Hoạt động hoàn hảo'
};

function setRating(val) {
    const ratingInput = document.getElementById('condition-rating');
    const ratingText = document.getElementById('rating-text');
    ratingInput.value = val;
    ratingText.textContent = ratingDescriptions[val] || `${val}/5`;

    document.querySelectorAll('#star-container .star-btn').forEach(btn => {
        const starVal = parseInt(btn.dataset.val, 10);
        if (starVal <= val) {
            btn.classList.add('text-amber-400');
            btn.classList.remove('text-slate-300');
        } else {
            btn.classList.remove('text-amber-400');
            btn.classList.add('text-slate-300');
        }
    });

    saveDraftDebounced();
}

// ==========================================
// --- QUẢN LÝ ẢNH & CAPACITOR CAMERA ---
// ==========================================
function renderPhotoGallery() {
    const gallery = document.getElementById('photo-gallery');
    const photoCount = document.getElementById('photo-count');
    
    photoCount.textContent = `${photosBase64.length} ảnh`;

    if (photosBase64.length === 0) {
        gallery.classList.add('hidden');
        gallery.innerHTML = '';
        return;
    }

    gallery.classList.remove('hidden');
    gallery.innerHTML = '';

    photosBase64.forEach((base64, index) => {
        const div = document.createElement('div');
        div.className = 'relative aspect-square rounded-xl border border-slate-200 overflow-hidden shadow-sm bg-slate-100 group';
        div.innerHTML = `
            <img src="${base64}" class="w-full h-full object-cover">
            <button type="button" data-index="${index}" class="btn-remove-photo absolute top-1 right-1 bg-black/70 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 shadow transition-colors">✕</button>
        `;
        gallery.appendChild(div);
    });

    // Gắn sự kiện xóa ảnh
    gallery.querySelectorAll('.btn-remove-photo').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            photosBase64.splice(idx, 1);
            renderPhotoGallery();
            saveDraft();
        });
    });
}

function handleImageFiles(files) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach(file => {
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = ev => {
                photosBase64.push(ev.target.result);
                renderPhotoGallery();
                saveDraft();
            };
            reader.readAsDataURL(file);
        }
    });
}

// Xử lý nút Camera (Tích hợp @capacitor/camera chuẩn Native)
async function triggerCamera() {
    const isNative = Capacitor.isNativePlatform();
    console.log(`[Camera] Triggered - Native platform: ${isNative}`);

    if (isNative) {
        try {
            const image = await Camera.getPhoto({
                quality: 80,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Camera
            });

            if (image && image.dataUrl) {
                photosBase64.push(image.dataUrl);
                renderPhotoGallery();
                saveDraft();
            }
        } catch (error) {
            console.warn('[Camera] Native camera capture failed or cancelled:', error);
            // Người dùng có thể nhấn Cancel hoặc từ chối quyền
        }
    } else {
        // Fallback Web: Trigger click vào file input capture camera
        document.getElementById('camera-input').click();
    }
}

// ==========================================
// --- TRẠNG THÁI MẠNG & CAPACITOR NETWORK ---
// ==========================================
let isDeviceOnline = navigator.onLine;

function updateNetworkBadge(online) {
    isDeviceOnline = online;
    const badge = document.getElementById('network-status');
    const envNetwork = document.getElementById('env-network');

    if (online) {
        badge.textContent = 'ONLINE';
        badge.className = 'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-emerald-100 text-emerald-700 transition-all';
        if (envNetwork) envNetwork.textContent = 'Đã kết nối (Online)';
    } else {
        badge.textContent = 'OFFLINE';
        badge.className = 'px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-red-100 text-red-700 transition-all';
        if (envNetwork) envNetwork.textContent = 'Ngoại tuyến (Offline)';
    }
}

async function initNetworkListener() {
    // 1. Kiểm tra ban đầu với Capacitor Network
    try {
        const status = await Network.getStatus();
        updateNetworkBadge(status.connected);
    } catch (e) {
        updateNetworkBadge(navigator.onLine);
    }

    // 2. Lắng nghe thay đổi mạng qua @capacitor/network
    try {
        Network.addListener('networkStatusChange', (status) => {
            console.log('[Network] Status change:', status);
            updateNetworkBadge(status.connected);
            if (status.connected) {
                syncPendingData();
            }
        });
    } catch (e) {
        console.warn('[Network] Network listener fallback to window events:', e);
    }

    // 3. Fallback qua window events (Web PWA)
    window.addEventListener('online', () => {
        console.log('[Network] Window online event');
        updateNetworkBadge(true);
        syncPendingData();
    });

    window.addEventListener('offline', () => {
        console.log('[Network] Window offline event');
        updateNetworkBadge(false);
    });
}

// ==========================================
// --- LƯU NHÁP CỤC BỘ (LOCAL DRAFT PERSISTENCE) ---
// ==========================================
let draftTimeout;
function saveDraftDebounced() {
    clearTimeout(draftTimeout);
    draftTimeout = setTimeout(saveDraft, 400);
}

async function saveDraft() {
    try {
        const db = await dbPromise;
        const draftData = {
            key: 'current_survey_draft',
            inspector: document.getElementById('inspector-name').value,
            building: document.getElementById('building').value,
            floor: document.getElementById('floor').value,
            roomNumber: document.getElementById('room-number').value,
            category: document.getElementById('category').value,
            conditionRating: document.getElementById('condition-rating').value,
            defectNotes: document.getElementById('defect-notes').value,
            location: document.getElementById('location-input').value,
            photos: photosBase64,
            updatedAt: new Date().toISOString()
        };
        await db.put('drafts', draftData);
    } catch (e) {
        console.warn('Lỗi khi lưu nháp:', e);
    }
}

async function restoreDraft() {
    try {
        const db = await dbPromise;
        const draft = await db.get('drafts', 'current_survey_draft');
        if (!draft) return;

        // Kiểm tra xem draft có nội dung không
        const hasContent = draft.inspector || draft.roomNumber || draft.defectNotes || (draft.photos && draft.photos.length > 0);
        if (!hasContent) return;

        if (draft.inspector) document.getElementById('inspector-name').value = draft.inspector;
        if (draft.building) document.getElementById('building').value = draft.building;
        if (draft.floor) document.getElementById('floor').value = draft.floor;
        if (draft.roomNumber) document.getElementById('room-number').value = draft.roomNumber;
        if (draft.category) document.getElementById('category').value = draft.category;
        if (draft.conditionRating) setRating(parseInt(draft.conditionRating, 10));
        if (draft.defectNotes) document.getElementById('defect-notes').value = draft.defectNotes;
        if (draft.location) document.getElementById('location-input').value = draft.location;
        if (draft.photos && draft.photos.length > 0) {
            photosBase64 = draft.photos;
            renderPhotoGallery();
        }

        document.getElementById('draft-alert').classList.remove('hidden');
    } catch (e) {
        console.warn('Không thể phục hồi bản nháp:', e);
    }
}

async function clearDraft() {
    try {
        const db = await dbPromise;
        await db.delete('drafts', 'current_survey_draft');
        document.getElementById('draft-alert').classList.add('hidden');
    } catch (e) {
        console.warn('Lỗi xóa nháp:', e);
    }
}

// ==========================================
// --- ĐỒNG BỘ GOOGLE SHEETS & HÀNG ĐỢI ---
// ==========================================
async function sendToGoogleSheets(survey) {
    const webhookUrl = document.getElementById('webhook-url').value || DEFAULT_WEBHOOK_URL;
    if (!webhookUrl) throw new Error("Chưa có Webhook URL");

    const payload = {
        id: survey.id,
        inspector: survey.inspector,
        building: survey.building,
        floor: survey.floor,
        roomNumber: survey.roomNumber,
        category: survey.category,
        conditionRating: survey.conditionRating,
        defectNotes: survey.defectNotes,
        location: survey.location,
        photosCount: survey.photos ? survey.photos.length : 0,
        photos: survey.photos || [],
        timestamp: survey.timestamp,
        timestampFormatted: survey.timestampFormatted,
        source: Capacitor.isNativePlatform() ? 'Capacitor Android Native' : 'PWA Standalone Web'
    };

    const res = await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    });

    return true;
}

async function syncPendingData() {
    if (isSyncing) return;
    if (!isDeviceOnline) {
        console.log('[Sync] Thiết bị đang Offline, chờ kết nối để đồng bộ.');
        return;
    }

    const db = await dbPromise;
    const allSurveys = await db.getAll('surveys');
    const pendingList = allSurveys.filter(s => s.status === 'PENDING_SYNC');

    if (pendingList.length === 0) {
        updateBadgePending(0);
        return;
    }

    isSyncing = true;
    const indicator = document.getElementById('sync-indicator');
    if (indicator) indicator.classList.remove('hidden');

    let successCount = 0;
    console.log(`[Sync] Bắt đầu đồng bộ ${pendingList.length} phiếu PENDING_SYNC...`);

    // Gửi tuần tự để tránh nghẽn mạng
    for (const survey of pendingList) {
        try {
            await sendToGoogleSheets(survey);
            survey.status = 'SYNCED';
            survey.syncedAt = new Date().toISOString();
            await db.put('surveys', survey);
            successCount++;
        } catch (error) {
            console.error('[Sync] Lỗi khi gửi phiếu:', survey.id, error);
            // Gặp lỗi mạng đột ngột thì dừng đợt sync hiện tại
            break;
        }
    }

    isSyncing = false;
    if (indicator) indicator.classList.add('hidden');

    if (successCount > 0) {
        loadHistory();
        console.log(`[Sync] Đã đồng bộ thành công ${successCount} phiếu lên Google Sheets!`);
    }

    // Cập nhật lại số lượng pending còn lại
    const remainingPending = (await db.getAll('surveys')).filter(s => s.status === 'PENDING_SYNC').length;
    updateBadgePending(remainingPending);
}

function updateBadgePending(count) {
    const badge = document.getElementById('badge-pending');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

// ==========================================
// --- LỊCH SỬ KHẢO SÁT & XEM CHI TIẾT ---
// ==========================================
async function loadHistory() {
    const db = await dbPromise;
    const surveys = await db.getAll('surveys');
    const container = document.getElementById('session-history');
    const summary = document.getElementById('history-summary');

    if (!container) return;

    const pendingCount = surveys.filter(s => s.status === 'PENDING_SYNC').length;
    const syncedCount = surveys.filter(s => s.status === 'SYNCED').length;
    updateBadgePending(pendingCount);

    if (summary) {
        summary.textContent = `Tổng: ${surveys.length} | Chờ: ${pendingCount} | Đã đồng bộ: ${syncedCount}`;
    }

    let filtered = surveys;
    if (currentFilter !== 'all') {
        filtered = surveys.filter(s => s.status === currentFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center p-8 bg-slate-50 rounded-2xl border border-slate-200">
                <p class="text-3xl mb-2">📋</p>
                <p class="text-sm font-bold text-slate-600">Không có dữ liệu khảo sát</p>
                <p class="text-xs text-slate-400 mt-1">Hãy chuyển sang tab "Khảo Sát" để tạo mới.</p>
            </div>
        `;
        return;
    }

    // Hiển thị mới nhất lên đầu
    filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    container.innerHTML = '';
    filtered.forEach(item => {
        const isSynced = item.status === 'SYNCED';
        const statusBadge = isSynced
            ? `<span class="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2.5 py-0.5 rounded-full flex items-center space-x-1"><span>✓</span><span>Đã Đồng Bộ</span></span>`
            : `<span class="text-[10px] font-bold bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full flex items-center space-x-1"><span>⏳</span><span>Chờ Gửi</span></span>`;

        let thumbHtml = '';
        if (item.photos && item.photos.length > 0) {
            thumbHtml = `
                <div class="mt-2.5 flex items-center space-x-2">
                    <img src="${item.photos[0]}" class="h-14 w-14 object-cover rounded-lg border border-slate-200">
                    <span class="text-[11px] text-slate-500 font-medium">+${item.photos.length} ảnh hiện trường</span>
                </div>
            `;
        }

        const stars = '★'.repeat(item.conditionRating) + '☆'.repeat(5 - item.conditionRating);

        const card = document.createElement('div');
        card.className = 'bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative cursor-pointer hover:border-sky-300 active:scale-[0.99] transition-all';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-1">
                <div>
                    <span class="text-[11px] font-bold text-sky-700 uppercase tracking-wide bg-sky-50 px-2 py-0.5 rounded">${item.category}</span>
                    <h3 class="font-extrabold text-slate-800 text-sm mt-1">${item.building} - ${item.roomNumber} (${item.floor})</h3>
                </div>
                ${statusBadge}
            </div>
            <div class="flex items-center space-x-1 text-amber-500 text-xs my-1">
                <span>${stars}</span>
                <span class="text-slate-500 text-[11px]">(${item.conditionRating}/5)</span>
            </div>
            <p class="text-xs text-slate-600 line-clamp-2 mt-1"><b>Lỗi:</b> ${item.defectNotes}</p>
            ${thumbHtml}
            <div class="flex justify-between items-center text-[10px] text-slate-400 font-medium mt-2.5 pt-2 border-t border-slate-100">
                <span>👤 ${item.inspector}</span>
                <span>🕒 ${item.timestampFormatted}</span>
            </div>
        `;
        card.addEventListener('click', () => openDetailModal(item));
        container.appendChild(card);
    });
}

function openDetailModal(item) {
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('modal-content');
    if (!modal || !content) return;

    let photosHtml = '';
    if (item.photos && item.photos.length > 0) {
        photosHtml = `
            <div class="pt-3 border-t border-slate-100">
                <p class="text-xs font-bold text-slate-600 mb-2">Ảnh Hiện Trường (${item.photos.length}):</p>
                <div class="grid grid-cols-1 gap-2.5">
                    ${item.photos.map(p => `<img src="${p}" class="w-full rounded-xl border border-slate-200 shadow-sm max-h-72 object-contain bg-slate-900">`).join('')}
                </div>
            </div>
        `;
    }

    const stars = '★'.repeat(item.conditionRating) + '☆'.repeat(5 - item.conditionRating);

    content.innerHTML = `
        <div class="space-y-2.5 text-xs">
            <div class="flex justify-between items-center">
                <span class="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-bold uppercase text-[10px]">${item.category}</span>
                <span class="text-[10px] ${item.status === 'SYNCED' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}">
                    ${item.status === 'SYNCED' ? '✓ Đã đồng bộ' : '⏳ Chờ gửi (PENDING_SYNC)'}
                </span>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <p>🏢 <b>Tòa nhà:</b> ${item.building}</p>
                <p>🪜 <b>Tầng:</b> ${item.floor}</p>
                <p>🚪 <b>Số phòng:</b> ${item.roomNumber}</p>
                <p>👤 <b>Kiểm toán viên:</b> ${item.inspector}</p>
                <p>⭐ <b>Tình trạng:</b> <span class="text-amber-500 font-bold">${stars}</span> (${item.conditionRating}/5)</p>
                <p>📍 <b>Tọa độ GPS:</b> ${item.location || 'Chưa ghi nhận'}</p>
                <p>🆔 <b>UUID:</b> <code class="text-[10px] text-slate-500 select-all">${item.id}</code></p>
                <p>🕒 <b>Thời gian:</b> ${item.timestampFormatted}</p>
            </div>
            <div>
                <label class="block text-xs font-bold text-slate-600 mb-1">Chi Tiết Lỗi / Ghi Chú:</label>
                <div class="bg-slate-100 p-3 rounded-xl text-slate-700 whitespace-pre-wrap">${item.defectNotes}</div>
            </div>
            ${photosHtml}
        </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modal.classList.remove('opacity-0'), 10);
}

function closeDetailModal() {
    const modal = document.getElementById('detail-modal');
    if (!modal) return;
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }, 200);
}

// ==========================================
// --- TIỆN ÍCH CÀI ĐẶT & THÔNG TIN ---
// ==========================================
function updateEnvSettings() {
    const envPlatform = document.getElementById('env-platform');
    const isNative = Capacitor.isNativePlatform();
    if (envPlatform) {
        envPlatform.textContent = isNative 
            ? `Capacitor Android Native (App ID: com.vku.fieldsurvey)` 
            : `Web PWA Standalone (Browser Mode)`;
    }
}

// ==========================================
// --- SỰ KIỆN KHỞI CHẠY (DOM READY) ---
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Khởi tạo DB & nạp config
    await initDB();
    document.getElementById('webhook-url').value = DEFAULT_WEBHOOK_URL;

    // 2. Lắng nghe trạng thái mạng
    await initNetworkListener();

    // 3. Khôi phục nháp nếu có
    await restoreDraft();

    // 4. Tab Navigation buttons
    document.getElementById('nav-new').addEventListener('click', () => switchTab('new', 'Khảo Sát Hiện Trường'));
    document.getElementById('nav-history').addEventListener('click', () => switchTab('history', 'Lịch Sử Khảo Sát'));
    document.getElementById('nav-settings').addEventListener('click', () => switchTab('settings', 'Cài Đặt Hệ Thống'));

    // 5. Star rating click events
    document.querySelectorAll('#star-container .star-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseInt(btn.dataset.val, 10);
            setRating(val);
        });
    });

    // 6. Camera & Gallery Input Events
    document.getElementById('btn-camera').addEventListener('click', triggerCamera);
    document.getElementById('camera-input').addEventListener('change', e => {
        handleImageFiles(e.target.files);
        e.target.value = '';
    });
    document.getElementById('gallery-input').addEventListener('change', e => {
        handleImageFiles(e.target.files);
        e.target.value = '';
    });

    // 7. GPS Button Event
    document.getElementById('btn-location').addEventListener('click', () => {
        const locInput = document.getElementById('location-input');
        locInput.value = "Đang lấy tọa độ GPS...";
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    locInput.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
                    saveDraft();
                },
                (err) => {
                    console.warn('GPS Error:', err);
                    alert("Không thể lấy GPS. Vui lòng cấp quyền vị trí hoặc bật định vị.");
                    locInput.value = "";
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } else {
            alert("Trình duyệt/thiết bị không hỗ trợ Geolocation API");
            locInput.value = "";
        }
    });

    // 8. Auto-save form draft on inputs
    ['inspector-name', 'building', 'floor', 'room-number', 'category', 'defectNotes'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', saveDraftDebounced);
            el.addEventListener('change', saveDraftDebounced);
        }
    });

    document.getElementById('btn-discard-draft').addEventListener('click', async () => {
        if (confirm("Hủy bản nháp và xóa dữ liệu đang nhập?")) {
            await clearDraft();
            document.getElementById('survey-form').reset();
            photosBase64 = [];
            renderPhotoGallery();
            setRating(5);
        }
    });

    // 9. Submit Form Khảo Sát
    document.getElementById('survey-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('btn-submit');
        submitBtn.disabled = true;

        const surveyData = {
            id: crypto.randomUUID ? crypto.randomUUID() : `VKU-${Date.now()}-${Math.floor(Math.random()*1000)}`,
            inspector: document.getElementById('inspector-name').value.trim(),
            building: document.getElementById('building').value,
            floor: document.getElementById('floor').value,
            roomNumber: document.getElementById('room-number').value.trim(),
            category: document.getElementById('category').value,
            conditionRating: parseInt(document.getElementById('condition-rating').value, 10),
            defectNotes: document.getElementById('defect-notes').value.trim(),
            location: document.getElementById('location-input').value.trim(),
            photos: [...photosBase64],
            timestamp: new Date().toISOString(),
            timestampFormatted: new Date().toLocaleString('vi-VN'),
            status: 'PENDING_SYNC' // Yêu cầu đề bài: Lưu ở trạng thái PENDING_SYNC
        };

        const db = await dbPromise;

        // Lưu trước vào IndexedDB
        await db.put('surveys', surveyData);

        // Xóa nháp
        await clearDraft();

        // Kiểm tra mạng và thử đồng bộ ngay
        if (isDeviceOnline) {
            try {
                await sendToGoogleSheets(surveyData);
                surveyData.status = 'SYNCED';
                surveyData.syncedAt = new Date().toISOString();
                await db.put('surveys', surveyData);
                alert("✅ Đã lưu và đồng bộ thành công lên máy chủ Google Sheets!");
            } catch (err) {
                console.warn('[Save] Lỗi mạng khi gửi, lưu hàng đợi PENDING_SYNC:', err);
                alert("💾 Ngoại tuyến: Khảo sát đã được lưu vào IndexedDB với trạng thái PENDING_SYNC. Dữ liệu sẽ tự động đồng bộ khi có mạng!");
            }
        } else {
            alert("💾 Ngoại tuyến: Đã lưu an toàn vào hàng đợi IndexedDB (PENDING_SYNC). Sẽ tự động gửi khi phát hiện có mạng Wi-Fi/4G!");
        }

        // Reset form
        document.getElementById('survey-form').reset();
        document.getElementById('location-input').value = '';
        photosBase64 = [];
        renderPhotoGallery();
        setRating(5);
        submitBtn.disabled = false;

        // Chuyển sang xem tab Lịch sử
        switchTab('history', 'Lịch Sử Khảo Sát');
    });

    // 10. Manual Sync Button
    document.getElementById('btn-manual-sync').addEventListener('click', async () => {
        await syncPendingData();
    });

    // 11. Modal close button
    document.getElementById('btn-close-modal').addEventListener('click', closeDetailModal);
    document.getElementById('detail-modal').addEventListener('click', (e) => {
        if (e.target.id === 'detail-modal') closeDetailModal();
    });

    // 12. History filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => {
                b.classList.remove('bg-sky-600', 'text-white');
                b.classList.add('bg-slate-100', 'text-slate-600');
            });
            btn.classList.add('bg-sky-600', 'text-white');
            btn.classList.remove('bg-slate-100', 'text-slate-600');
            currentFilter = btn.dataset.filter;
            loadHistory();
        });
    });

    // 13. Settings Actions (Clear DB & Export JSON)
    document.getElementById('btn-export-json').addEventListener('click', async () => {
        const db = await dbPromise;
        const allSurveys = await db.getAll('surveys');
        const blob = new Blob([JSON.stringify(allSurveys, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vku-surveys-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('btn-clear-db').addEventListener('click', async () => {
        if (confirm("⚠️ CẢNH BÁO: Xóa toàn bộ dữ liệu khảo sát trong IndexedDB trên thiết bị? Hành động này không thể hoàn tác.")) {
            const db = await dbPromise;
            await db.clear('surveys');
            await db.clear('drafts');
            alert("Đã làm sạch toàn bộ dữ liệu cục bộ!");
            loadHistory();
        }
    });

    // 14. PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
            console.log('[PWA] Service Worker registered:', reg.scope);
            // Đăng ký Background Sync nếu trình duyệt hỗ trợ
            if ('sync' in reg) {
                reg.sync.register('sync-vku-surveys').catch(e => console.log('Background Sync unhandled:', e));
            }
        }).catch(err => console.error('[PWA] Service Worker registration failed:', err));

        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'TRIGGER_SYNC') {
                syncPendingData();
            }
        });
    }

    // Tự động kiểm tra và đồng bộ ban đầu nếu đang có mạng
    setTimeout(() => {
        if (navigator.onLine) {
            syncPendingData();
        }
    }, 1500);
});
