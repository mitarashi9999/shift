/**
 * worker.js - スタッフ用シフト確認アプリメインロジック
 */

let employees = [];
let shifts = [];
let messages = [];
let currentUser = null;
let currentViewDate = new Date(); // カレンダーで表示中の月

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initUI();
});

const DEFAULT_EMPLOYEES = [
    { id: "e1", name: "田中" },
    { id: "e2", name: "佐藤" }
];

const DEFAULT_SHIFTS = [
    { id: "s1", date: "2026-03-20", employeeId: "e1", start: "09:00", end: "18:00" }
];

// ========== データ読み込み ==========
function loadData() {
    const loadedEmployees = localStorage.getItem('shift_employees');
    const loadedShifts = localStorage.getItem('shift_shifts');

    if (!loadedEmployees) {
        employees = [...DEFAULT_EMPLOYEES];
        localStorage.setItem('shift_employees', JSON.stringify(employees));
    } else {
        employees = JSON.parse(loadedEmployees);
    }

    if (!loadedShifts) {
        shifts = [...DEFAULT_SHIFTS];
        localStorage.setItem('shift_shifts', JSON.stringify(shifts));
    } else {
        shifts = JSON.parse(loadedShifts);
    }

    const loadedMessages = localStorage.getItem('shift_messages');
    if (loadedMessages) {
        messages = JSON.parse(loadedMessages);
    }
}

// ========== UI初期化 & イベント ==========
function initUI() {
    const loginView = document.getElementById('login-view');
    const calendarView = document.getElementById('calendar-view');
    const select = document.getElementById('employee-select');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');

    // 従業員セレクトボックスの構築
    if (employees.length === 0) {
        select.innerHTML = '<option value="" disabled selected>従業員がいません(管理画面で追加してください)</option>';
    } else {
        select.innerHTML = '<option value="" disabled selected>名前を選んでください</option>';
        employees.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = emp.name;
            select.appendChild(option);
        });
    }

    // 以前ログインしたユーザーがいれば自動遷移
    const savedUserId = localStorage.getItem('my_shift_user_id');
    if (savedUserId && employees.some(e => e.id === savedUserId)) {
        currentUser = employees.find(e => e.id === savedUserId);
        showCalendarView();
    }

    // ログインボタン処理
    loginBtn.addEventListener('click', () => {
        const empId = select.value;
        if (!empId) {
            alert('名前を選択してください');
            return;
        }
        currentUser = employees.find(e => e.id === empId);
        localStorage.setItem('my_shift_user_id', currentUser.id);
        showCalendarView();
    });

    // ログアウト処理
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('my_shift_user_id');
        currentUser = null;
        calendarView.classList.remove('active');
        setTimeout(() => {
            calendarView.style.display = 'none';
            loginView.style.display = 'flex';
            // force reflow
            void loginView.offsetWidth;
            loginView.classList.add('active');
        }, 400);
    });

    // カレンダー月移動
    document.getElementById('prev-month').addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() + 1);
        renderCalendar();
    });

    // メッセージモーダルイベント
    const messagesBtn = document.getElementById('messages-btn');
    const messagesModal = document.getElementById('messages-modal');
    const closeMessagesBtn = document.getElementById('close-messages-btn');

    if (messagesBtn && messagesModal) {
        messagesBtn.addEventListener('click', () => {
            renderMessages();
            messagesModal.showModal();
        });

        closeMessagesBtn.addEventListener('click', () => {
            messagesModal.close();
        });

        messagesModal.addEventListener('click', (e) => {
            if (e.target === messagesModal) messagesModal.close();
        });
    }
}

// ========== メッセージ表示 ==========
function formatDateTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

function renderMessages() {
    const list = document.getElementById('messages-list');
    if (!list || !currentUser) return;

    // 自分宛て または 全員宛て をフィルタして新しい順にソート
    const myMessages = messages
        .filter(m => m.to === 'all' || m.to === currentUser.id)
        .sort((a, b) => b.timestamp - a.timestamp);

    if (myMessages.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:var(--text-secondary); padding: 20px;">お知らせはありません</div>';
        return;
    }

    list.innerHTML = myMessages.map(m => `
        <div class="msg-item ${m.to === 'all' ? 'msg-all' : ''}">
            <span class="msg-time">${formatDateTime(m.timestamp)} ${m.to === 'all' ? '(全員共通)' : '(あなた宛)'}</span>
            <div class="msg-text">${m.content}</div>
        </div>
    `).join('');
}

function showCalendarView() {
    const loginView = document.getElementById('login-view');
    const calendarView = document.getElementById('calendar-view');
    
    document.getElementById('current-user-name').textContent = currentUser.name + ' さん';
    currentViewDate = new Date(); // 今日をリセット表示

    loginView.classList.remove('active');
    setTimeout(() => {
        loginView.style.display = 'none';
        calendarView.style.display = 'flex';
        // force reflow
        void calendarView.offsetWidth;
        calendarView.classList.add('active');
        renderCalendar();
    }, 400);
}

// ========== カレンダー描画 ==========
function formatDateISO(date) {
    return `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;
}

function renderCalendar() {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    
    document.getElementById('current-month-display').textContent = `${year}年 ${month + 1}月`;
    
    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // その月の1日と最終日
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // 表示開始する前月の日数 (日曜日=0)
    const startDayOfWeek = firstDay.getDay();

    const todayStr = formatDateISO(new Date());

    // 前月分の空セル
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell other-month';
        cell.innerHTML = `<div class="cell-date">${prevMonthLastDay - i}</div>`;
        grid.appendChild(cell);
    }

    // 今月分のセル
    for (let date = 1; date <= lastDay.getDate(); date++) {
        const cellDate = new Date(year, month, date);
        const dateStr = formatDateISO(cellDate);
        
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';
        if (dateStr === todayStr) {
            cell.classList.add('today');
        }

        cell.innerHTML = `<div class="cell-date">${date}</div>`;

        // この日のこの人のシフトを探す
        const myShifts = shifts.filter(s => s.date === dateStr && s.employeeId === currentUser.id);
        
        // シフトを時間順に並べる
        myShifts.sort((a,b) => a.start.localeCompare(b.start)).forEach(s => {
            const badge = document.createElement('div');
            badge.className = 'shift-badge';
            // モバイルなどで見やすいように改行を入れる
            badge.innerHTML = `${s.start}<br>〜${s.end}`;
            cell.appendChild(badge);
        });

        grid.appendChild(cell);
    }

    // 次月分の空セルを埋めてグリッドをきれいに (42マス構成にする)
    const totalCells = startDayOfWeek + lastDay.getDate();
    const remainingCells = (totalCells % 7 === 0) ? 0 : 7 - (totalCells % 7);
    
    for (let i = 1; i <= remainingCells; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell other-month';
        cell.innerHTML = `<div class="cell-date">${i}</div>`;
        grid.appendChild(cell);
    }
}
