/**
 * シフト管理アプリ - メインスクリプト
 */

// ========== 初期データ & State ==========
let employees = [];
let shifts = [];
let messages = [];

let currentDate = new Date();
let viewMode = 'week'; // 'day' | 'week'
let editingShiftId = null;

const DEFAULT_EMPLOYEES = [
    { id: "e1", name: "田中" },
    { id: "e2", name: "佐藤" }
];

const DEFAULT_SHIFTS = [
    { id: "s1", date: "2026-03-20", employeeId: "e1", start: "09:00", end: "18:00" }
];

const DEFAULT_MESSAGES = [
    { id: "m1", to: "all", content: "明日は早出です", timestamp: 1710000000000 }
];

// ========== LocalStorage処理 ==========
function initStorage() {
    const loadedEmployees = localStorage.getItem('shift_employees');
    const loadedShifts = localStorage.getItem('shift_shifts');
    const loadedMessages = localStorage.getItem('shift_messages');

    if (!loadedEmployees) {
        employees = [...DEFAULT_EMPLOYEES];
        saveEmployees();
    } else {
        employees = JSON.parse(loadedEmployees);
    }

    if (!loadedShifts) {
        shifts = [...DEFAULT_SHIFTS];
        saveShifts();
    } else {
        shifts = JSON.parse(loadedShifts);
    }

    if (!loadedMessages) {
        messages = [...DEFAULT_MESSAGES];
        saveMessages();
    } else {
        messages = JSON.parse(loadedMessages);
    }
}

function saveEmployees() { localStorage.setItem('shift_employees', JSON.stringify(employees)); }
function saveShifts() { localStorage.setItem('shift_shifts', JSON.stringify(shifts)); }
function saveMessages() { localStorage.setItem('shift_messages', JSON.stringify(messages)); }

// ========== アプリ初期化 ==========
document.addEventListener('DOMContentLoaded', () => {
    initStorage();
    setupThemeToggle();
    setupServiceWorker();
    setupNetworkListeners();
    
    // UI初期描画
    renderEmployeeList();
    renderChatHistory();
    updateChatRecipients();
    
    // イベントリスナー登録
    initEvents();
});

// ========== Service Worker & Offline ==========
function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js').then((registration) => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, (err) => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }
}

function setupNetworkListeners() {
    const statusEl = document.getElementById('network-status');
    const updateOnlineStatus = () => {
        if (navigator.onLine) {
            statusEl.textContent = 'Online';
            statusEl.className = 'status online';
        } else {
            statusEl.textContent = 'Offline';
            statusEl.className = 'status offline';
            if (window.Notification && Notification.permission === "granted") {
                new Notification("オフラインモード", { body: "現在オフラインですが、シフト確認・編集は可能です。" });
            }
        }
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
}

// ========== テーマ (Dark Mode) ==========
function setupThemeToggle() {
    const themeBtn = document.getElementById('theme-toggle');
    const htmlEl = document.documentElement;
    
    const savedTheme = localStorage.getItem('shift_theme') || 'light';
    htmlEl.setAttribute('data-theme', savedTheme);
    themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

    themeBtn.addEventListener('click', () => {
        const currentTheme = htmlEl.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        htmlEl.setAttribute('data-theme', newTheme);
        localStorage.setItem('shift_theme', newTheme);
        themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    });
}

// ========== UIイベント登録 ==========
function initEvents() {
    // カレンダー初期描画
    renderCalendar();

    // カレンダーコントロール
    document.getElementById('view-day').addEventListener('click', (e) => {
        viewMode = 'day';
        e.target.classList.add('active');
        document.getElementById('view-week').classList.remove('active');
        renderCalendar();
    });
    
    document.getElementById('view-week').addEventListener('click', (e) => {
        viewMode = 'week';
        e.target.classList.add('active');
        document.getElementById('view-day').classList.remove('active');
        renderCalendar();
    });

    document.getElementById('prev-date').addEventListener('click', () => {
        const days = viewMode === 'week' ? 7 : 1;
        currentDate.setDate(currentDate.getDate() - days);
        renderCalendar();
    });

    document.getElementById('next-date').addEventListener('click', () => {
        const days = viewMode === 'week' ? 7 : 1;
        currentDate.setDate(currentDate.getDate() + days);
        renderCalendar();
    });

    document.getElementById('today-btn').addEventListener('click', () => {
        currentDate = new Date();
        renderCalendar();
    });

    // シフトモーダル制御
    const shiftModal = document.getElementById('shift-modal');
    const shiftForm = document.getElementById('shift-form');
    const deleteShiftBtn = document.getElementById('delete-shift-btn');

    shiftForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const date = document.getElementById('shift-date').value;
        const employeeId = document.getElementById('shift-employee').value;
        const start = document.getElementById('shift-start').value;
        const end = document.getElementById('shift-end').value;

        // 簡単なバリデーション
        if (start === end) {
            alert('開始時間と終了時間が同じです');
            return;
        }

        const getInts = (st, en) => st < en ? [[st, en]] : [[st, '24:00'], ['00:00', en]];
        const newInts = getInts(start, end);

        // 重複チェック
        const isOverlap = shifts.some(s => {
            if (s.id === editingShiftId || s.date !== date || s.employeeId !== employeeId) return false;
            const existInts = getInts(s.start, s.end);
            return newInts.some(a => existInts.some(b => a[0] < b[1] && b[0] < a[1]));
        });

        if (isOverlap) {
            if (!confirm('この従業員は指定された時間にすでにシフトが入っています。登録を続行しますか？')) {
                return;
            }
        }

        if (editingShiftId) {
            const shift = shifts.find(s => s.id === editingShiftId);
            if (shift) {
                shift.date = date;
                shift.employeeId = employeeId;
                shift.start = start;
                shift.end = end;
            }
        } else {
            shifts.push({
                id: 's' + Date.now(),
                date,
                employeeId,
                start,
                end
            });
        }

        saveShifts();
        renderCalendar();
        shiftModal.close();
    });

    deleteShiftBtn.addEventListener('click', () => {
        if (!editingShiftId) return;
        if (confirm('このシフトを削除しますか？')) {
            shifts = shifts.filter(s => s.id !== editingShiftId);
            saveShifts();
            renderCalendar();
            shiftModal.close();
        }
    });

    // 従業員追加モーダル
    const empModal = document.getElementById('employee-modal');
    const addEmpBtn = document.getElementById('add-employee-btn');
    const empForm = document.getElementById('employee-form');

    addEmpBtn.addEventListener('click', () => {
        empForm.reset();
        empModal.showModal();
    });

    empForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('emp-name').value.trim();
        const id = document.getElementById('emp-id').value.trim();
        if (!name || !id) return;

        // 重複チェック
        if (employees.some(emp => emp.id === id)) {
            alert('このIDは既に存在します。別のIDを入力してください。');
            return;
        }

        employees.push({ id, name });
        saveEmployees();
        renderEmployeeList();
        updateChatRecipients();
        empModal.close();
    });

    // モーダルキャンセルボタン共通
    document.querySelectorAll('.close-modal-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('dialog');
            if (modal) modal.close();
        });
    });

    // チャット送信
    const sendBtn = document.getElementById('send-btn');
    const chatInput = document.getElementById('chat-input');
    
    const sendMessage = () => {
        const content = chatInput.value.trim();
        if (!content) return;
        
        const to = document.getElementById('chat-recipient').value;
        const msg = {
            id: 'm' + Date.now(),
            to,
            content,
            timestamp: Date.now()
        };
        messages.push(msg);
        saveMessages();
        renderChatHistory();
        chatInput.value = '';
    };

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// ========== 従業員UI ==========
function renderEmployeeList() {
    const list = document.getElementById('employee-list');
    if (!list) return;
    list.innerHTML = employees.map(emp => `
        <li class="employee-item" data-id="${emp.id}">
            <div class="employee-info">
                <h4>${emp.name}</h4>
                <span>ID: ${emp.id}</span>
            </div>
            <button class="delete-emp-btn" onclick="deleteEmployee('${emp.id}')" title="削除">×</button>
        </li>
    `).join('');
    updateShiftEmployeeSelect();
}

window.deleteEmployee = function(id) {
    if (!confirm('本当に削除しますか？\n（関連するシフトも削除推奨ですが、ここでは従業員のみ削除します）')) return;
    employees = employees.filter(e => e.id !== id);
    saveEmployees();
    renderEmployeeList();
    updateChatRecipients();
    renderCalendar();
};

function updateShiftEmployeeSelect() {
    const shiftEmployeeSelect = document.getElementById('shift-employee');
    if (!shiftEmployeeSelect) return;
    const currentVal = shiftEmployeeSelect.value;
    shiftEmployeeSelect.innerHTML = employees.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('');
    if (currentVal && employees.some(e => e.id === currentVal)) {
        shiftEmployeeSelect.value = currentVal;
    }
}

// ========== チャットUI ==========
function formatTime(ts) {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

function renderChatHistory() {
    const history = document.getElementById('chat-history');
    if (!history) return;
    
    history.innerHTML = messages.map(msg => {
        const toName = msg.to === 'all' ? '全員へ' : (employees.find(e => e.id === msg.to)?.name || '不明');
        return `
            <div class="message admin-msg">
                <div class="msg-header">
                    <span>宛先: ${toName}</span>
                    <span class="msg-time">${formatTime(msg.timestamp)}</span>
                </div>
                <div class="msg-content">${msg.content}</div>
            </div>
        `;
    }).join('');
    
    history.scrollTop = history.scrollHeight;
}

function updateChatRecipients() {
    const select = document.getElementById('chat-recipient');
    if (!select) return;
    
    const currentVal = select.value;
    select.innerHTML = `<option value="all">全員へ</option>` + 
        employees.map(emp => `<option value="${emp.id}">${emp.name}</option>`).join('');
    
    if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
        select.value = currentVal;
    }
}

// ========== カレンダーUI ==========
function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 月曜始まり
    return new Date(d.setDate(diff));
}

function formatDateISO(date) {
    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
}

function renderDateDisplay() {
    const display = document.getElementById('current-date-display');
    if (viewMode === 'day') {
        display.textContent = `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月${currentDate.getDate()}日`;
    } else {
        const start = getStartOfWeek(currentDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        display.textContent = `${start.getMonth()+1}/${start.getDate()} 〜 ${end.getMonth()+1}/${end.getDate()}`;
    }
}

function renderCalendar() {
    renderDateDisplay();
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';
    
    let daysToRender = [];
    if (viewMode === 'day') {
        daysToRender.push(currentDate);
        grid.className = 'calendar-grid day-view';
    } else {
        const start = getStartOfWeek(currentDate);
        for(let i=0; i<7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            daysToRender.push(d);
        }
        grid.className = 'calendar-grid week-view';
    }

    daysToRender.forEach(d => {
        const dateStr = formatDateISO(d);
        const dayShifts = shifts.filter(s => s.date === dateStr);
        
        const dayCard = document.createElement('div');
        dayCard.className = 'calendar-day-card';
        const isToday = formatDateISO(new Date()) === dateStr;
        
        dayCard.innerHTML = `<div class="day-header ${isToday ? 'today' : ''}">${d.getMonth()+1}/${d.getDate()} (${['日','月','火','水','木','金','土'][d.getDay()]})</div>`;
        
        const shiftList = document.createElement('div');
        shiftList.className = 'day-shifts';
        
        dayShifts.sort((a,b) => a.start.localeCompare(b.start)).forEach(s => {
            const empName = employees.find(e => e.id === s.employeeId)?.name || '不明(削除済)';
            const shiftEl = document.createElement('div');
            shiftEl.className = 'shift-block';
            shiftEl.innerHTML = `<strong>${empName}</strong> ${s.start} - ${s.end}`;
            shiftEl.onclick = () => window.openShiftModal(s);
            shiftList.appendChild(shiftEl);
        });

        const addShiftBtn = document.createElement('button');
        addShiftBtn.className = 'add-shift-inline-btn';
        addShiftBtn.textContent = '+ シフト追加';
        addShiftBtn.onclick = () => window.openShiftModal(null, dateStr);

        dayCard.appendChild(shiftList);
        dayCard.appendChild(addShiftBtn);
        grid.appendChild(dayCard);
    });
}

window.openShiftModal = function(shift = null, dateStr = null) {
    const modal = document.getElementById('shift-modal');
    const form = document.getElementById('shift-form');
    const deleteBtn = document.getElementById('delete-shift-btn');
    const title = document.getElementById('shift-modal-title');
    
    updateShiftEmployeeSelect();

    if (shift) {
        title.textContent = 'シフトを編集';
        editingShiftId = shift.id;
        document.getElementById('shift-date').value = shift.date;
        document.getElementById('shift-employee').value = shift.employeeId;
        document.getElementById('shift-start').value = shift.start;
        document.getElementById('shift-end').value = shift.end;
        deleteBtn.classList.remove('hidden');
    } else {
        title.textContent = 'シフトを登録';
        editingShiftId = null;
        form.reset();
        document.getElementById('shift-date').value = dateStr || formatDateISO(currentDate);
        if(employees.length > 0) {
            document.getElementById('shift-employee').value = employees[0].id;
        }
        deleteBtn.classList.add('hidden');
    }
    
    modal.showModal();
}
