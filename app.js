/* ============================================================================
   Stock & Amasado — app.js
   Lógica de la aplicación: estado, renderizado, sincronización Firebase,
   tour guiado, modales y gestión de foco.
   Refactor: event delegation, dark-mode class-based, focus trapping.
============================================================================ */

/* ==========================================================================
   CONFIGURACIÓN
   ========================================================================== */

const SERVICES_CONFIG = [
    { key: 'desayuno', name: 'Desayuno', icon: 'icon-coffee', colorClass: 'border-amber-200 bg-amber-50' },
    { key: 'comida', name: 'Comida', icon: 'icon-sun', colorClass: 'border-orange-200 bg-orange-50' },
    { key: 'evento', name: 'Evento Extra', icon: 'icon-party', colorClass: 'border-purple-200 bg-purple-50' }
];

const DEFAULT_BREADS = {
    hogazas_blancas: { name: 'Hogazas Blancas', type: 'Blanco', defaultBatch: 20 },
    hogazas_integrales: { name: 'Hogazas Integrales', type: 'Integral', defaultBatch: 20 },
    barras_blancas: { name: 'Barras Blancas', type: 'Blanco', defaultBatch: 50 },
    barras_integrales: { name: 'Barras Integrales', type: 'Integral', defaultBatch: 50 },
    bollitos_blancos: { name: 'Bollitos Blancos', type: 'Blanco', defaultBatch: 100 },
    bollitos_integrales: { name: 'Bollitos Integrales', type: 'Integral', defaultBatch: 100 }
};

const BREAD_COLORS = {
    hogazas_blancas:     { dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300' },
    hogazas_integrales:  { dot: 'bg-orange-700', text: 'text-orange-800', bg: 'bg-orange-50', border: 'border-orange-400' },
    barras_blancas:      { dot: 'bg-sky-500', text: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-300' },
    barras_integrales:   { dot: 'bg-blue-700', text: 'text-blue-800', bg: 'bg-blue-50', border: 'border-blue-400' },
    bollitos_blancos:    { dot: 'bg-pink-500', text: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-300' },
    bollitos_integrales: { dot: 'bg-purple-600', text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-300' }
};

const SHORT_NAMES = {
    hogazas_blancas: 'H. Bl.',
    hogazas_integrales: 'H. Int.',
    barras_blancas: 'Bar. Bl.',
    barras_integrales: 'Bar. Int.',
    bollitos_blancos: 'Boll. Bl.',
    bollitos_integrales: 'Boll. Int.'
};

const DAY_NAMES_ES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto',
    'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/* ==========================================================================
   FIREBASE
   ========================================================================== */

const firebaseConfig = {
    apiKey: "AIzaSyB-FDPCgEO7P_yt3746vEbtqV0ElGVxaas",
    authDomain: "panaderia-stock-8fd02.firebaseapp.com",
    databaseURL: "https://panaderia-stock-8fd02-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "panaderia-stock-8fd02",
    storageBucket: "panaderia-stock-8fd02.firebasestorage.app",
    messagingSenderId: "933298619282",
    appId: "1:933298619282:web:77c20c2dfbafcef45e374b"
};

let db;
let stateRef;
let activityRef;

function initFirebase() {
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK no cargado');
        return false;
    }
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    stateRef = db.ref('obrador_panaderia/estado_v2');
    activityRef = db.ref('obrador_panaderia/actividad_v2');
    return true;
}

/* ==========================================================================
   ESTADO GLOBAL
   ========================================================================== */

let currentUserName = localStorage.getItem('panaderia_user_name') || '';
let isApplyingRemoteUpdate = false;
let firstSnapshotReceived = false;
let lastActivityEntries = [];
let quickDate = '';

let state = {
    stock: {},
    plans: {},
    weeklyRules: { 0: {}, 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {} },
    lastProcessedDate: null,
    tempBatchInputs: {},
    productSettings: {},
    customProducts: {},
    bakeSchedule: {}
};

function initDefaultState() {
    Object.keys(DEFAULT_BREADS).forEach(k => {
        if (!state.stock[k]) state.stock[k] = { qty: 0, margin: 5 };
        if (!state.productSettings[k]) state.productSettings[k] = { enabled: true, margin: 5 };
        if (!state.tempBatchInputs[k]) state.tempBatchInputs[k] = DEFAULT_BREADS[k].defaultBatch;
    });
    for (let i = 0; i <= 6; i++) {
        if (!state.weeklyRules[i]) state.weeklyRules[i] = {};
        SERVICES_CONFIG.forEach(s => {
            if (!state.weeklyRules[i][s.key]) state.weeklyRules[i][s.key] = { active: false, bread: {} };
        });
    }
}
initDefaultState();

/* ==========================================================================
   HELPERS DE FECHA
   ========================================================================== */

function getTodayDateString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, days) {
    const [y, m, d] = dateStr.split('-');
    const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    dt.setDate(dt.getDate() + days);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function getDayOfWeek(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d)).getDay();
}

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}`;
}

function getShortName(key) {
    return SHORT_NAMES[key] || key;
}

function getActiveBreadKeys() {
    return Object.keys(state.stock).filter(k => state.productSettings[k] && state.productSettings[k].enabled !== false);
}

function getBreadConfig(key) {
    if (DEFAULT_BREADS[key]) return DEFAULT_BREADS[key];
    if (state.customProducts[key]) return state.customProducts[key];
    return { name: key, type: 'Personalizado', defaultBatch: 20 };
}

function getEffectivePlan(dateStr) {
    if (state.plans[dateStr] && state.plans[dateStr].isException) {
        return state.plans[dateStr].services || {};
    }
    const dow = getDayOfWeek(dateStr);
    return state.weeklyRules[dow] || {};
}

function getScheduledBakesForDate(dateStr) {
    return state.bakeSchedule[dateStr] || {};
}

/* ==========================================================================
   HELPERS DOM / ICONOS
   ========================================================================== */

const $ = (selector, ctx = document) => ctx.querySelector(selector);
const $$ = (selector, ctx = document) => ctx.querySelectorAll(selector);

function icon(name, size = 'md', className = '') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.className = `icon icon-${size} ${className}`;
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#${name}`);
    svg.appendChild(use);
    return svg;
}

function safeHTML(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
}

function timeAgo(ts) {
    if (!ts) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 60) return 'Hace un momento';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Hace ${diffH} h`;
    return `Hace ${Math.floor(diffH / 24)} d`;
}

/* ==========================================================================
   GESTIÓN DE VISTAS
   ========================================================================== */

function switchView(view) {
    const views = ['stock', 'week', 'calendar', 'production'];
    views.forEach(v => {
        const section = document.getElementById(`view-${v}`);
        const btn = document.getElementById(`btn-${v}`);
        if (section) section.classList.toggle('hidden', v !== view);
        if (btn) {
            btn.classList.remove('bg-white', 'text-bakery-primary', 'shadow-sm', 'border');
            btn.classList.add('text-neutral-500', 'hover:text-bakery-primary');
            if (v === view) {
                btn.classList.remove('text-neutral-500');
                btn.classList.add('bg-white', 'text-bakery-primary', 'shadow-sm', 'border', 'border-neutral-100');
            }
        }
    });
    if (view === 'production') renderProductionChecklist();
    else renderAll();
}

/* ==========================================================================
   GESTIÓN DE MODALES (con focus trap)
   ========================================================================== */

const openModals = [];

function openModal(modalId) {
    const backdrop = document.getElementById(modalId);
    if (!backdrop) return;
    backdrop.classList.remove('hidden');
    const modal = backdrop.querySelector('.modal');
    openModals.push({ backdrop, modal, trigger: document.activeElement });
    if (modal) {
        trapFocus(modal);
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeModal(modalId) {
    const backdrop = document.getElementById(modalId);
    if (!backdrop) return;
    backdrop.classList.add('hidden');
    const modal = backdrop.querySelector('.modal');
    if (modal) modal.setAttribute('aria-hidden', 'true');
    const idx = openModals.findIndex(m => m.backdrop === backdrop);
    if (idx > -1) {
        const entry = openModals.splice(idx, 1)[0];
        if (entry.modal) releaseFocusTrap(entry.modal);
        if (entry.trigger) entry.trigger.focus();
    }
    if (openModals.length > 0) {
        trapFocus(openModals[openModals.length - 1].modal);
    }
}

function trapFocus(container) {
    const focusable = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();

    function keyListener(e) {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
        } else {
            if (document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }
    container._keyListener = keyListener;
    container.addEventListener('keydown', keyListener);
    container._prevKeyListener = () => container.removeEventListener('keydown', keyListener);
}

function releaseFocusTrap(container) {
    if (container._prevKeyListener) container._prevKeyListener();
}

/* ==========================================================================
   MODO OSCURO (class-based)
   ========================================================================== */

function initDarkMode() {
    const saved = localStorage.getItem('panaderia_dark_mode');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = saved === 'dark' || (saved === null && prefersDark);
    applyDarkMode(isDark);
    updateDarkModeButton(isDark);
}

function applyDarkMode(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('panaderia_dark_mode', isDark ? 'dark' : 'light');
}

function toggleDarkMode() {
    const isDark = !document.documentElement.classList.contains('dark');
    applyDarkMode(isDark);
    updateDarkModeButton(isDark);
}

function updateDarkModeButton(isDark) {
    const btn = $('#btn-dark-mode');
    if (!btn) return;
    btn.innerHTML = '';
    if (isDark) {
        btn.appendChild(icon('icon-sun', 'sm'));
        btn.textContent = '';
        const span = document.createElement('span');
        span.textContent = 'Modo Claro';
        btn.appendChild(span);
        btn.setAttribute('aria-label', 'Cambiar a modo claro');
    } else {
        btn.appendChild(icon('icon-moon', 'sm'));
        const span = document.createElement('span');
        span.textContent = 'Modo Oscuro';
        btn.appendChild(span);
        btn.setAttribute('aria-label', 'Cambiar a modo oscuro');
    }
}

/* ==========================================================================
   PERSONALIZACIÓN
   ========================================================================== */

function loadTheme() {
    const color = localStorage.getItem('themeColor');
    if (color) setThemeColor(color);
    const font = localStorage.getItem('fontFamily');
    if (font) setFontFamily(font);
}

function setThemeColor(color) {
    document.documentElement.style.setProperty('--color-accent', color);
    localStorage.setItem('themeColor', color);
    const map = {
        '#4A2C11': { dark: '#8B5A2B', light: '#F5EBE1' },
        '#8B5A2B': { dark: '#4A2C11', light: '#F5EBE1' },
        '#1E3A5F': { dark: '#2563EB', light: '#dbeafe' },
        '#2D6A4F': { dark: '#16a34e', light: '#dcfce7' },
        '#6B4C3A': { dark: '#4A2C11', light: '#F5EBE1' },
        '#7B2D26': { dark: '#A83232', light: '#fee2e2' }
    };
    const mapped = map[color] || { dark: '#8B5A2B', light: '#F5EBE1' };
    document.documentElement.style.setProperty('--color-accent-dark', mapped.dark);
    document.documentElement.style.setProperty('--color-accent-light', mapped.light);
    const hover = color === '#4A2C11' ? '#8B5A2B' :
                  color === '#8B5A2B' ? '#4A2C11' :
                  color === '#1E3A5F' ? '#2563EB' :
                  color === '#2D6A4F' ? '#16a34e' :
                  color === '#6B4C3A' ? '#4A2C11' : '#7B2D26';
    document.documentElement.style.setProperty('--color-accent-hover', hover);
}

function setFontFamily(font) {
    document.documentElement.style.setProperty('--font-body', font);
    localStorage.setItem('fontFamily', font);
    document.body.style.fontFamily = font;
}

/* ==========================================================================
   EVENT DELEGATION — manejador principal
   ========================================================================== */

function setupEventDelegation() {
    document.body.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.tagName !== 'BUTTON' && btn.tagName !== 'A') {
            if (btn.type !== 'checkbox' && btn.type !== 'radio') {
                e.preventDefault();
            }
        }
        const action = btn.dataset.action;
        const handlers = {
            'switch-view': () => switchView(btn.dataset.view),
            'toggle-config-dropdown': toggleConfigDropdown,
            'open-modal': () => openModal(btn.dataset.modal),
            'close-modal': () => closeModal(btn.dataset.modal),
            'open-name-modal': openNameModal,
            'open-activity-modal': openActivityModal,
            'toggle-dark-mode': toggleDarkMode,
            'remove-custom-product': () => removeCustomProduct(btn.dataset.key),
            'schedule-bake': () => scheduleBakeFromCard(btn.dataset.bread),
            'close-panel': closeQuickPanel,
            'save-quick-plan': saveQuickPlan,
            'save-quick-comment': saveQuickComment,
            'open-weekly-rules': () => openModal('modal-weekly-rules'),
            'open-products': () => openModal('modal-products'),
            'open-theme': () => openModal('modal-theme'),
            'open-schedule-bake': () => openModal('modal-schedule-bake'),
            'restart-tour': restartTour,
            'change-month': () => changeMonth(parseInt(btn.dataset.dir)),
            'set-today-month': setTodayMonth,
            'open-quick-panel': () => openQuickPanel(btn.dataset.date),
            'register-production': () => registerProductionFromTask(btn.dataset.date, btn.dataset.bread),
            'add-product': addCustomProduct,
            'harvest-bake': () => harvestBake(btn.dataset.date, btn.dataset.bread),
            'save-weekly-rules': saveWeeklyRules,
            'save-product-settings': saveProductSettings,
            'save-scheduled-bake': saveScheduledBake,
            'save-user-name': saveUserName,
            'close-name-modal': () => closeModal('modal-name'),
            'dismiss-notification': dismissNotification,
            'set-theme-color': () => setThemeColor(btn.dataset.color),
            'next-tour-step': nextTourStep,
            'end-tour': endTour
        };
        const handler = handlers[action];
        if (handler) handler();
        if (btn.dataset.closeDropdown !== undefined) {
            const dd = document.getElementById('configDropdown');
            if (dd) dd.classList.remove('show');
        }
    });

    document.body.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && openModals.length > 0) {
            const last = openModals[openModals.length - 1];
            closeModal(last.modal.id);
        }
    });

    document.body.addEventListener('change', function(e) {
        const target = e.target;
        if (target.classList.contains('weekly-svc-toggle')) {
            const inputs = $$(`[data-dow="${target.dataset.dow}"][data-svc="${target.dataset.svc}"]`);
            inputs.forEach(inp => { inp.disabled = !target.checked; });
        }
        if (target.classList.contains('product-enabled-toggle')) {
            toggleProductEnabledFromCheckbox(target);
        }
        if (target.id === 'font-family-select') {
            setFontFamily(target.value);
        }
        if (target.dataset.action === 'toggle-task') {
            toggleTask(target.dataset.date, target.dataset.bread, target.checked);
            setTimeout(renderProductionChecklist, 100);
        }
    });

    document.body.addEventListener('input', function(e) {
        const target = e.target;
        if (target.classList.contains('stock-input')) {
            setDirectQty(target.dataset.key, target.value);
        }
        if (target.classList.contains('batch-input')) {
            updateTempBatch(target.dataset.key, target.value);
        }
        if (target.classList.contains('product-margin-input')) {
            const key = target.dataset.key;
            const val = parseInt(target.value) || 5;
            if (!state.productSettings[key]) state.productSettings[key] = { enabled: true, margin: 5 };
            state.productSettings[key].margin = val;
            if (state.stock[key]) state.stock[key].margin = val;
        }
    });
}

/* ==========================================================================
   DROPDOWN CONFIG
   ========================================================================== */

function toggleConfigDropdown() {
    const el = document.getElementById('configDropdown');
    if (el) el.classList.toggle('show');
}

/* Close dropdown when clicking outside */
document.addEventListener('click', function(e) {
    const container = document.querySelector('.dropdown');
    if (container && !container.contains(e.target)) {
        const dd = document.getElementById('configDropdown');
        if (dd) dd.classList.remove('show');
    }
});

/* ==========================================================================
   MODALES — Tema / Personalización
   ========================================================================== */

function setupThemeModal() {
    const container = document.getElementById('color-options');
    if (!container) return;
    const colors = ['#4A2C11', '#8B5A2B', '#1E3A5F', '#2D6A4F', '#6B4C3A', '#7B2D26'];
    container.innerHTML = '';
    colors.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-8 h-8 rounded-full border-2 border-neutral-300 focus:outline-none focus:ring-2 focus:ring-offset-1';
        btn.style.background = c;
        btn.setAttribute('data-action', 'set-theme-color');
        btn.dataset.color = c;
        btn.setAttribute('aria-label', `Color: ${c}`);
        container.appendChild(btn);
    });
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'w-8 h-8 p-0 border-0 cursor-pointer rounded-full';
    colorPicker.value = '#4A2C11';
    colorPicker.setAttribute('aria-label', 'Selector de color personalizado');
    colorPicker.addEventListener('input', function(e) {
        setThemeColor(e.target.value);
    });
    container.appendChild(colorPicker);
}

/* ==========================================================================
   COMENTARIOS
   ========================================================================== */

function loadCommentsForDate(dateStr) {
    if (!db) return;
    const ref = db.ref('obrador_panaderia/comments/' + dateStr);
    ref.on('value', snap => {
        const comment = snap.val() || '';
        const display = document.getElementById('quick-panel-comment-display');
        const textarea = document.getElementById('quick-panel-comment');
        if (display) display.textContent = comment ? `📝 ${comment}` : 'Sin comentarios';
        if (textarea) textarea.value = comment;
    });
}

function saveQuickComment() {
    if (!db) return;
    const dateStr = quickDate;
    const comment = document.getElementById('quick-panel-comment').value.trim();
    if (comment) {
        db.ref('obrador_panaderia/comments/' + dateStr).set(comment);
        logActivity(`añadió comentario para ${formatDate(dateStr)}: "${comment}"`);
    } else {
        db.ref('obrador_panaderia/comments/' + dateStr).remove();
        logActivity(`eliminó comentario para ${formatDate(dateStr)}`);
    }
    updateCommentBadge();
}

function updateCommentBadge() {
    if (!db) return;
    const today = getTodayDateString();
    const ref = db.ref('obrador_panaderia/comments/' + today);
    ref.once('value', snap => {
        const badge = document.getElementById('comment-badge');
        if (snap.val()) {
            badge.classList.remove('hidden');
            badge.textContent = '💬 1';
        } else {
            badge.classList.add('hidden');
        }
    });
}

/* ==========================================================================
   PRODUCCIÓN (checklist)
   ========================================================================== */

function renderProductionChecklist() {
    const container = document.getElementById('production-checklist');
    if (!container) return;
    const today = getTodayDateString();
    const bakes = getScheduledBakesForDate(today);
    const tasks = Object.keys(bakes);
    if (tasks.length === 0) {
        container.innerHTML = '<p class="text-sm text-neutral-400">No hay amasadoras programadas para hoy. 🎉</p>';
        return;
    }
    if (!db) {
        container.innerHTML = '<p class="text-sm text-neutral-400">Firebase no disponible.</p>';
        return;
    }
    const tasksRef = db.ref('obrador_panaderia/dailyTasks/' + today);
    tasksRef.on('value', snap => {
        const taskStatus = snap.val() || {};
        let html = '';
        tasks.forEach(bk => {
            const status = taskStatus[bk] || 'pending';
            const checked = status === 'done' ? 'checked' : '';
            const labelClass = status === 'done' ? 'line-through opacity-60' : '';
            const config = getBreadConfig(bk);
            html += `
                <div class="flex items-center gap-3 p-3 bg-neutral-50 rounded-xl border border-bakery-border">
                    <input type="checkbox" ${checked} data-action="toggle-task"
                           data-date="${today}" data-bread="${bk}"
                           class="w-5 h-5 accent-bakery-accent focus:ring-2 focus:ring-bakery-accent">
                    <span class="flex-1 font-medium ${labelClass}">${safeHTML(config.name)}</span>
                    ${status === 'done'
                        ? `<span class="text-xs text-green-600 font-bold">✅ Finalizada</span>`
                        : `<span class="text-xs text-amber-600 font-bold">⏳ Pendiente</span>`
                    }
                    <button data-action="register-production"
                            data-date="${today}" data-bread="${bk}"
                            class="btn-harvest">📦 Registrar</button>
                </div>
            `;
        });
        container.innerHTML = html;
    });
}

function toggleTask(date, breadKey, done) {
    if (!db) return;
    const ref = db.ref('obrador_panaderia/dailyTasks/' + date + '/' + breadKey);
    if (done) {
        ref.set('done');
        logActivity(`marcó como finalizada la amasadora de ${getBreadConfig(breadKey).name} para hoy`);
    } else {
        ref.set('pending');
        logActivity(`marcó como pendiente la amasadora de ${getBreadConfig(breadKey).name} para hoy`);
    }
    renderProductionChecklist();
}

function registerProductionFromTask(date, breadKey) {
    harvestBake(date, breadKey);
    setTimeout(renderProductionChecklist, 300);
}

/* ==========================================================================
   TOUR GUIADO
   ========================================================================== */

let tourSteps = [];
let currentStep = 0;
let tourActive = false;

function startTour() {
    if (localStorage.getItem('tourSeen') === 'true') return;
    tourSteps = [
        { target: '#btn-stock', title: '📦 Stock', desc: 'Aquí ves el stock actual de cada producto. Puedes añadir stock manualmente o programar amasadoras.' },
        { target: '#btn-week', title: '🗓️ Semana', desc: 'Planificación de los próximos 7 días. Cada columna muestra lo que se consume y las amasadoras programadas.' },
        { target: '#btn-calendar', title: '📅 Calendario', desc: 'Vista mensual con todos los consumos, amasadoras y fechas de agotamiento.' },
        { target: '#btn-production', title: '📋 Producción', desc: 'Checklist de las amasadoras programadas para hoy. Marca las que ya has hecho.' },
        { target: '#btn-config', title: '⚙️ Configuración', desc: 'Aquí puedes gestionar reglas semanales, productos, personalizar colores y reiniciar el tour.' },
        { target: '#harvest-panel', title: '🧑‍🍳 Registro', desc: 'Cuando tengas amasadoras pendientes de registrar, aparecerán aquí. ¡No olvides registrar la producción real!' },
    ];
    tourActive = true;
    currentStep = 0;
    showStep(0);
}

function showStep(index) {
    if (index >= tourSteps.length) { endTour(); return; }
    const step = tourSteps[index];
    const target = document.querySelector(step.target);
    if (!target) { showStep(index + 1); return; }

    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    target.classList.add('tour-highlight');

    const rect = target.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip animate-fade-in';
    tooltip.style.top = (rect.bottom + window.scrollY + 16) + 'px';
    tooltip.style.left = (rect.left + rect.width / 2 - 150 + window.scrollX) + 'px';
    if (tooltip.style.left.startsWith('-')) tooltip.style.left = '20px';
    if (parseInt(tooltip.style.left) + 300 > window.innerWidth) tooltip.style.left = (window.innerWidth - 320) + 'px';

    tooltip.innerHTML = `
        <div class="tour-title">${step.title}</div>
        <div class="tour-desc">${step.desc}</div>
        <div class="tour-actions">
            <button class="btn-skip-tour btn-ghost" data-action="end-tour">Saltar</button>
            <button class="btn-next-tour btn-primary" data-action="next-tour-step">${index === tourSteps.length - 1 ? 'Finalizar' : 'Siguiente →'}</button>
        </div>
    `;
    const existing = document.querySelector('.tour-tooltip');
    if (existing) existing.remove();
    document.body.appendChild(tooltip);

    let overlay = document.querySelector('.tour-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'tour-overlay';
        document.body.appendChild(overlay);
    }

}

function nextTourStep() {
    currentStep++;
    showStep(currentStep);
}

function endTour() {
    tourActive = false;
    document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
    const tooltip = document.querySelector('.tour-tooltip');
    if (tooltip) tooltip.remove();
    const overlay = document.querySelector('.tour-overlay');
    if (overlay) overlay.remove();
    localStorage.setItem('tourSeen', 'true');
}

function restartTour() {
    localStorage.removeItem('tourSeen');
    endTour();
    setTimeout(startTour, 300);
}

/* ==========================================================================
   REPROCESAMIENTO / MERMAS
   ========================================================================== */

function recalculateStockFrom(dateStr) {
    return new Promise((resolve, reject) => {
        const prevDate = addDays(dateStr, -1);
        const prevStockRef = db.ref('obrador_panaderia/dailyStock/' + prevDate);
        prevStockRef.once('value', snap => {
            let stock = snap.val() || {};
            if (Object.keys(stock).length === 0) {
                stock = {};
                Object.keys(state.stock).forEach(k => { stock[k] = state.stock[k].qty; });
                logActivity(`⚠️ No se encontró historial para ${formatDate(prevDate)}, usando stock actual como base.`);
            }
            let currentDate = dateStr;
            const today = getTodayDateString();
            let simStock = { ...stock };
            while (currentDate <= today) {
                const plan = getEffectivePlan(currentDate);
                SERVICES_CONFIG.forEach(svcConf => {
                    const svc = plan[svcConf.key];
                    if (svc && svc.active && svc.bread) {
                        Object.entries(svc.bread).forEach(([bk, qty]) => {
                            if (qty > 0 && simStock[bk] !== undefined) {
                                simStock[bk] = Math.max(0, simStock[bk] - qty);
                            }
                        });
                    }
                });
                currentDate = addDays(currentDate, 1);
            }
            let updated = false;
            Object.keys(simStock).forEach(k => {
                if (state.stock[k] !== undefined && state.stock[k].qty !== simStock[k]) {
                    state.stock[k].qty = simStock[k];
                    updated = true;
                }
            });
            if (updated) {
                state.lastProcessedDate = today;
                logActivity(`🔄 Recalculado stock desde ${formatDate(dateStr)} hasta hoy.`);
                saveStateToCloud();
                db.ref('obrador_panaderia/dailyStock/' + today).set(simStock);
                renderAll();
            }
            resolve();
        });
    });
}

function processAutoDepletions() {
    if (!db || !state.lastProcessedDate) {
        if (!state.lastProcessedDate) {
            state.lastProcessedDate = getTodayDateString();
            saveStateToCloud();
        }
        return;
    }
    const todayStr = getTodayDateString();
    if (state.lastProcessedDate >= todayStr) return;

    let runnerStr = addDays(state.lastProcessedDate, 1);
    let allLogs = [];
    while (runnerStr <= todayStr) {
        const plan = getEffectivePlan(runnerStr);
        let logs = [];
        SERVICES_CONFIG.forEach(svcConf => {
            const svc = plan[svcConf.key];
            if (svc && svc.active && svc.bread) {
                Object.entries(svc.bread).forEach(([bKey, qty]) => {
                    if (qty > 0 && state.stock[bKey]) {
                        state.stock[bKey].qty = Math.max(0, state.stock[bKey].qty - qty);
                        logs.push(`${getShortName(bKey)} (-${qty})`);
                    }
                });
            }
        });
        if (logs.length > 0) {
            allLogs.push(`• ${formatDate(runnerStr)}: ${logs.join(', ')}`);
        }
        db.ref('obrador_panaderia/dailyStock/' + runnerStr).set({ ...state.stock });
        runnerStr = addDays(runnerStr, 1);
    }
    state.lastProcessedDate = todayStr;
    if (allLogs.length > 0) {
        saveStateToCloud();
        document.getElementById('notification-text-content').textContent = allLogs.join('\n');
        document.getElementById('notification-panel').classList.remove('hidden');
    } else {
        saveStateToCloud();
    }
}

function dismissNotification() {
    document.getElementById('notification-panel').classList.add('hidden');
}

/* ==========================================================================
   PROYECCIONES
   ========================================================================== */

function calculateProjections() {
    const simStock = {};
    const activeKeys = getActiveBreadKeys();
    activeKeys.forEach(k => { simStock[k] = state.stock[k] ? state.stock[k].qty : 0; });
    const autonomyDates = {};
    const criticalOrders = [];
    let runnerStr = addDays(getTodayDateString(), 1);
    for (let i = 0; i < 45; i++) {
        const plan = getEffectivePlan(runnerStr);
        activeKeys.forEach(bKey => {
            if (autonomyDates[bKey]) return;
            let dailyUsage = 0;
            SERVICES_CONFIG.forEach(s => {
                if (plan[s.key] && plan[s.key].active && plan[s.key].bread && plan[s.key].bread[bKey]) {
                    dailyUsage += parseInt(plan[s.key].bread[bKey]) || 0;
                }
            });
            if (dailyUsage > 0) {
                const margin = state.productSettings[bKey] ? state.productSettings[bKey].margin || 5 : 5;
                if (simStock[bKey] <= margin) {
                    if (!criticalOrders.some(o => o.bread === bKey)) {
                        criticalOrders.push({ bread: bKey, date: runnerStr, remaining: simStock[bKey] });
                    }
                }
                simStock[bKey] -= dailyUsage;
                if (simStock[bKey] <= 0) {
                    autonomyDates[bKey] = runnerStr;
                }
            }
        });
        runnerStr = addDays(runnerStr, 1);
    }
    return { autonomy: autonomyDates, orders: criticalOrders };
}

function getWeekConsumption() {
    const today = getTodayDateString();
    const consumption = {};
    const activeKeys = getActiveBreadKeys();
    activeKeys.forEach(k => consumption[k] = 0);
    for (let d = 1; d <= 7; d++) {
        const dateStr = addDays(today, d);
        const plan = getEffectivePlan(dateStr);
        SERVICES_CONFIG.forEach(s => {
            const svc = plan[s.key];
            if (svc && svc.active && svc.bread) {
                Object.entries(svc.bread).forEach(([bk, qty]) => {
                    if (qty > 0 && consumption[bk] !== undefined) {
                        consumption[bk] += qty;
                    }
                });
            }
        });
    }
    return consumption;
}

/* ==========================================================================
   AMASADORAS PENDIENTES
   ========================================================================== */

function getPendingHarvests() {
    const today = getTodayDateString();
    const pending = [];
    Object.keys(state.bakeSchedule).forEach(dateStr => {
        if (dateStr < today) {
            const items = state.bakeSchedule[dateStr];
            Object.keys(items).forEach(bk => {
                if (items[bk] === true) {
                    pending.push({ date: dateStr, bread: bk });
                }
            });
        }
    });
    return pending;
}

function checkPendingHarvests() {
    const pending = getPendingHarvests();
    const panel = document.getElementById('harvest-panel');
    const list = document.getElementById('harvest-list');
    const badge1 = document.getElementById('pending-badge');
    const badge2 = document.getElementById('pending-badge-header');
    if (pending.length > 0) {
        badge1.classList.remove('hidden');
        badge1.textContent = String(pending.length);
        badge2.classList.remove('hidden');
        badge2.textContent = String(pending.length);
        panel.classList.remove('hidden');
        list.innerHTML = pending.map(p => `
            <div class="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-green-200">
                <span class="text-sm font-bold">${safeHTML(getBreadConfig(p.bread).name)}</span>
                <span class="text-xs text-neutral-500">(${formatDate(p.date)})</span>
                <button data-action="harvest-bake" data-date="${p.date}" data-bread="${p.bread}" class="btn-harvest">✅ Registrar</button>
            </div>
        `).join('');
    } else {
        badge1.classList.add('hidden');
        badge2.classList.add('hidden');
        panel.classList.add('hidden');
    }
}

function harvestBake(dateStr, breadKey) {
    const scheduled = state.bakeSchedule[dateStr];
    if (!scheduled || !scheduled[breadKey]) return;
    const qtyStr = prompt(`¿Cuántas unidades de "${getBreadConfig(breadKey).name}" has producido realmente?`, "20");
    if (qtyStr === null) return;
    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0) {
        alert("Cantidad no válida.");
        return;
    }
    if (state.stock[breadKey]) {
        state.stock[breadKey].qty += qty;
        logActivity(`registró amasadora de ${getBreadConfig(breadKey).name} (+${qty} uds) del ${formatDate(dateStr)}`);
    }
    delete scheduled[breadKey];
    if (Object.keys(scheduled).length === 0) {
        delete state.bakeSchedule[dateStr];
    }
    const today = getTodayDateString();
    db.ref('obrador_panaderia/dailyStock/' + today).set({ ...state.stock });
    saveStateToCloud();
    renderAll();
    checkPendingHarvests();
}

/* ==========================================================================
   PROGRAMAR AMASADORA
   ========================================================================== */

function scheduleBakeFromCard(breadKey) {
    document.getElementById('schedule-bread-key').value = breadKey;
    document.getElementById('schedule-product-name').textContent = getBreadConfig(breadKey).name;
    const tomorrow = addDays(getTodayDateString(), 1);
    document.getElementById('schedule-date').value = tomorrow;
    openModal('modal-schedule-bake');
}

function saveScheduledBake() {
    const breadKey = document.getElementById('schedule-bread-key').value;
    const date = document.getElementById('schedule-date').value;
    if (!date || !breadKey) return;
    if (!state.bakeSchedule[date]) state.bakeSchedule[date] = {};
    state.bakeSchedule[date][breadKey] = true;
    logActivity(`programó amasadora de ${getBreadConfig(breadKey).name} para el ${formatDate(date)} (inicio)`);
    closeModal('modal-schedule-bake');
    saveStateToCloud();
    renderAll();
}

/* ==========================================================================
   RENDER STOCK
   ========================================================================== */

function renderStock() {
    const grid = document.getElementById('stock-grid');
    if (!grid) return;

    let totalQty = 0;
    const activeKeys = getActiveBreadKeys();
    activeKeys.forEach(k => { totalQty += state.stock[k] ? state.stock[k].qty : 0; });
    const totalEl = document.getElementById('total-stock-count');
    if (totalEl) totalEl.textContent = String(totalQty);

    const proj = calculateProjections();
    const weekCons = getWeekConsumption();
    updateGentleBakeAlert(proj);

    grid.innerHTML = '';
    activeKeys.forEach(key => {
        const item = state.stock[key] || { qty: 0, margin: 5 };
        const config = getBreadConfig(key);
        const settings = state.productSettings[key] || { enabled: true, margin: 5 };
        const isEnabled = settings.enabled !== false;
        const margin = settings.margin || 5;
        const isCritical = item.qty <= margin;
        const batchVal = state.tempBatchInputs[key] || config.defaultBatch || 20;

        let autonomyLabel = '';
        if (proj.autonomy[key]) {
            const [, m, d] = proj.autonomy[key].split('-');
            autonomyLabel = `<span class="text-amber-600 font-bold">🟡 Hasta ${d}/${m}</span>`;
        } else {
            autonomyLabel = `<span class="text-emerald-600 font-bold">🟢 +45 días</span>`;
        }
        if (isCritical) {
            autonomyLabel = `<span class="text-red-600 font-bold">⚠️ Bajo mínimos (${margin})</span>`;
        }

        const weekNeed = weekCons[key] || 0;
        const weekOk = item.qty >= weekNeed;
        const weekBadge = weekOk
            ? `<span class="badge badge-ok">✅ Semana cubierta</span>`
            : `<span class="badge badge-warn">⚠️ Necesitas ${weekNeed}</span>`;

        const colors = BREAD_COLORS[key] || BREAD_COLORS[Object.keys(DEFAULT_BREADS)[0]];

        grid.innerHTML += `
            <div class="product-card ${isEnabled ? '' : 'disabled'} ${isCritical ? 'critical' : ''}">
                <div class="flex justify-between items-start mb-3">
                    <h3 class="text-xl font-bold text-bakery-primary">${safeHTML(config.name)}</h3>
                    ${weekBadge}
                </div>
                <div class="text-[10px] bg-neutral-50 dark:bg-neutral-800/40 p-1.5 rounded-lg border border-neutral-100 dark:border-neutral-700 flex items-center justify-between mb-3">
                    <span class="text-neutral-500 uppercase font-bold tracking-wide">Autonomía:</span>
                    ${autonomyLabel}
                </div>
                <div class="flex flex-col items-center my-4 mb-4">
                    <div class="flex items-baseline gap-2">
                        <input type="number" value="${item.qty}" min="0"
                               data-key="${key}"
                               class="stock-input input-qty ${isCritical ? 'critical' : ''}"
                               inputmode="numeric"
                               aria-label="Stock de ${safeHTML(config.name)}">
                        <span class="text-[10px] text-neutral-400">/ ${margin}</span>
                    </div>
                    <span class="text-[9px] text-neutral-400 font-bold uppercase mt-1">Stock / Margen</span>
                </div>
                <div class="pt-4 border-t border-bakery-border flex gap-2 items-end">
                    <div class="w-16">
                        <label class="block text-[8px] font-bold text-neutral-500 uppercase mb-1 text-center">Lote</label>
                        <input type="number" id="batch-${key}" value="${batchVal}" min="1"
                               data-action="update-batch" data-key="${key}"
                               class="input-number batch-input"
                               aria-label="Tamaño de lote para ${safeHTML(config.name)}">
                    </div>
                    <button data-action="replenish-batch" data-key="${key}"
                            class="flex-1 btn-primary py-2 rounded-xl text-xs font-bold">➕ Amasar</button>
                    <button data-action="schedule-bake" data-bread="${key}"
                            class="p-2 btn-primary rounded-xl text-xs font-bold"
                            aria-label="Programar amasadora de ${safeHTML(config.name)}">📅</button>
                </div>
            </div>
        `;
    });
}

/* Event delegation handlers for stock actions */
function setDirectQty(key, value) {
    const newQty = Math.max(0, parseInt(value) || 0);
    if (newQty !== state.stock[key].qty) {
        logActivity(`cambió ${getBreadConfig(key).name} a ${newQty} uds`);
    }
    state.stock[key].qty = newQty;
    saveStateToCloud();
    renderStock();
    renderTodaySummary();
}

function updateTempBatch(key, value) {
    state.tempBatchInputs[key] = parseInt(value) || 1;
    saveStateToCloud();
}

function replenishBatch(key) {
    const config = getBreadConfig(key);
    const inputVal = parseInt(document.getElementById(`batch-${key}`).value) || config.defaultBatch || 20;
    state.stock[key].qty += inputVal;
    logActivity(`amasó un lote de ${config.name} (+${inputVal} uds)`);
    saveStateToCloud();
    renderStock();
    renderTodaySummary();
}

/* ==========================================================================
   ALERTA SUAVE (gentle bake)
   ========================================================================== */

function updateGentleBakeAlert(proj) {
    const alertPanel = document.getElementById('gentle-bake-alert');
    const alertText = document.getElementById('gentle-alert-text');
    if (!alertPanel || !alertText) return;
    if (proj.orders.length > 0) {
        const firstOrder = proj.orders[0];
        const dateFmt = formatDate(firstOrder.date);
        alertText.textContent = `⚠️ Necesitas iniciar la amasadora de ${getBreadConfig(firstOrder.bread).name} antes del ${dateFmt} para no romper el stock de seguridad.`;
        alertPanel.classList.remove('hidden');
    } else {
        alertPanel.classList.add('hidden');
    }
}

/* ==========================================================================
   VISTA SEMANA
   ========================================================================== */

function renderWeekPlan() {
    const container = document.getElementById('week-grid-container');
    if (!container) return;
    container.innerHTML = '';
    const today = getTodayDateString();
    const activeKeys = getActiveBreadKeys();
    const proj = calculateProjections();
    const startDate = addDays(today, 1);
    const endDate = addDays(today, 7);
    const rangeEl = document.getElementById('week-range');
    if (rangeEl) rangeEl.textContent = `${formatDate(startDate)} — ${formatDate(endDate)}`;

    for (let d = 1; d <= 7; d++) {
        const dateStr = addDays(today, d);
        const plan = getEffectivePlan(dateStr);
        const dow = getDayOfWeek(dateStr);
        const dayName = DAY_NAMES_ES[dow === 0 ? 6 : dow - 1];
        const consumo = {};
        activeKeys.forEach(k => consumo[k] = 0);
        SERVICES_CONFIG.forEach(s => {
            const svc = plan[s.key];
            if (svc && svc.active && svc.bread) {
                Object.entries(svc.bread).forEach(([bk, qty]) => {
                    if (qty > 0 && consumo[bk] !== undefined) consumo[bk] += qty;
                });
            }
        });
        const bakes = getScheduledBakesForDate(dateStr);
        const hasBake = Object.keys(bakes).length > 0;
        const runOut = Object.keys(proj.autonomy).filter(bk => proj.autonomy[bk] === dateStr);

        const col = document.createElement('div');
        col.className = 'week-day-col';
        col.style.cursor = 'pointer';
        col.addEventListener('click', () => openQuickPanel(dateStr));

        const header = document.createElement('div');
        header.className = 'day-header';
        header.innerHTML = `
            <span class="day-name">${dayName}</span>
            <span class="day-date">${formatDate(dateStr)}</span>
        `;
        col.appendChild(header);

        const tasks = Object.entries(consumo).filter(([, qty]) => qty > 0);
        if (tasks.length === 0 && !hasBake && runOut.length === 0) {
            col.innerHTML += '<div class="no-tasks">Sin tareas</div>';
        } else {
            tasks.forEach(([bk, qty]) => {
                const item = document.createElement('div');
                item.className = 'task-item';
                item.innerHTML = `
                    <span>${safeHTML(getBreadConfig(bk).name)}</span>
                    <span class="qty">${qty} uds</span>
                `;
                col.appendChild(item);
            });
            if (hasBake) {
                col.innerHTML += `<div class="bake-task">🧑‍🍳 ${Object.keys(bakes).map(bk => getShortName(bk)).join(', ')}</div>`;
            }
            if (runOut.length) {
                col.innerHTML += `<div class="urgent-badge">🔚 ${runOut.map(bk => getShortName(bk)).join(', ')}</div>`;
            }
        }
        container.appendChild(col);
    }
}

/* ==========================================================================
   CALENDARIO
   ========================================================================== */

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const title = document.getElementById('calendar-title');
    if (title) title.textContent = `📅 ${MONTH_NAMES[currentMonth]} ${currentYear}`;

    let firstDay = new Date(currentYear, currentMonth, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const todayStr = getTodayDateString();
    const proj = calculateProjections();

    const runOutByDate = {};
    Object.keys(proj.autonomy).forEach(bk => {
        const date = proj.autonomy[bk];
        if (!runOutByDate[date]) runOutByDate[date] = [];
        runOutByDate[date].push(bk);
    });

    const legend = document.getElementById('autonomy-legend');
    const breadsWithAutonomy = Object.keys(proj.autonomy);
    if (breadsWithAutonomy.length && legend) {
        legend.innerHTML = `<span class="text-[10px] font-bold text-neutral-400 uppercase self-center mr-1">🔚 Se agota:</span>` +
            breadsWithAutonomy.map(bk => {
                const c = BREAD_COLORS[bk] || { dot: 'bg-gray-400', text: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-300' };
                const [, m, d] = proj.autonomy[bk].split('-');
                return `<span class="inline-flex items-center gap-1 text-[10px] font-bold ${c.text} ${c.bg} border ${c.border} px-2 py-1 rounded-full"><span class="w-2 h-2 rounded-full ${c.dot}"></span>${getShortName(bk)} · ${d}/${m}</span>`;
            }).join('');
    } else if (legend) {
        legend.innerHTML = `<span class="text-[10px] text-emerald-600 font-bold">🟢 Todo el stock cubre los próximos 45 días</span>`;
    }

    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += '<div class="bg-neutral-50/40 rounded-2xl min-h-[100px]"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isException = state.plans[dateStr] && state.plans[dateStr].isException;
        const plan = getEffectivePlan(dateStr);
        const scheduledBakes = getScheduledBakesForDate(dateStr);
        const hasScheduledBake = Object.keys(scheduledBakes).length > 0;
        const isPending = hasScheduledBake && dateStr < todayStr;

        let serviceHtml = [];
        SERVICES_CONFIG.forEach(s => {
            if (plan[s.key] && plan[s.key].active) {
                let totalB = 0;
                if (plan[s.key].bread) Object.values(plan[s.key].bread).forEach(v => totalB += parseInt(v) || 0);
                if (totalB > 0) {
                    serviceHtml.push(`<div class="text-[9px] bg-white border border-bakery-border rounded px-1 py-0.5 flex justify-between shadow-sm ${s.colorClass}"><span title="${s.name}">${s.icon}</span><span class="font-bold text-bakery-primary">${totalB}</span></div>`);
                }
            }
        });

        let runOutHtml = '';
        const runOutBreads = runOutByDate[dateStr];
        if (runOutBreads && runOutBreads.length) {
            runOutHtml = `<div class="mt-1 flex flex-wrap gap-0.5">` + runOutBreads.map(bk => {
                const c = BREAD_COLORS[bk] || { dot: 'bg-gray-400', text: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-300' };
                return `<span class="w-full text-[8px] font-bold ${c.text} ${c.bg} border ${c.border} rounded px-1 py-0.5 flex items-center gap-1 truncate" title="${safeHTML(getBreadConfig(bk).name)} se agota"><span class="w-1.5 h-1.5 rounded-full ${c.dot} shrink-0"></span>${getShortName(bk)}</span>`;
            }).join('') + `</div>`;
        }

        let bakeHtml = '';
        if (hasScheduledBake) {
            const items = Object.keys(scheduledBakes).map(bk => getShortName(bk)).join(', ');
            const pendingClass = isPending ? 'bg-orange-200 text-orange-800' : 'bg-blue-100 text-blue-800';
            const pendingText = isPending ? '⏳ Pendiente' : '';
            bakeHtml = `<div class="mt-1 text-[8px] ${pendingClass} rounded px-1 py-0.5 font-bold truncate" title="Amasadora programada: ${items}">${pendingText}</div>`;
        }

        const isToday = dateStr === todayStr;
        const highlight = isToday ? 'ring-2 ring-bakery-accent border-bakery-accent'
            : runOutBreads ? 'border-red-200' : 'border-bakery-border';
        const bgType = isException ? 'bg-amber-50/40 border-amber-200'
            : serviceHtml.length > 0 ? 'bg-white' : 'bg-neutral-50/50';

        grid.innerHTML += `
            <div data-action="open-quick-panel" data-date="${dateStr}"
                 class="border ${highlight} ${bgType} rounded-2xl p-2 min-h-[115px] flex flex-col justify-between cursor-pointer hover:shadow-md transition">
                <div>
                    <div class="flex justify-between items-start">
                        <span class="font-bold text-sm ${isToday ? 'text-bakery-accent' : 'text-neutral-700'}">${day}</span>
                        <span class="text-[8px] ${isException ? 'text-bakery-accent' : 'text-neutral-300'} font-bold">${isException ? '📌 Mod' : '⚙️ Auto'}</span>
                    </div>
                    <div class="mt-1 space-y-1">${serviceHtml.join('')}</div>
                </div>
                ${runOutHtml}
                ${bakeHtml}
            </div>
        `;
    }

    const list = document.getElementById('calendar-list');
    if (list) {
        const items = [];
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isException = state.plans[dateStr] && state.plans[dateStr].isException;
            const plan = getEffectivePlan(dateStr);
            const scheduledBakes = getScheduledBakesForDate(dateStr);
            const hasScheduledBake = Object.keys(scheduledBakes).length > 0;
            const isPending = hasScheduledBake && dateStr < todayStr;
            const isToday = dateStr === todayStr;
            const runOutBreads = runOutByDate[dateStr];

            let summary = [];
            SERVICES_CONFIG.forEach(s => {
                if (plan[s.key] && plan[s.key].active) {
                    let totalB = 0;
                    if (plan[s.key].bread) Object.values(plan[s.key].bread).forEach(v => totalB += parseInt(v) || 0);
                    if (totalB > 0) summary.push(`${s.icon} ${totalB}`);
                }
            });
            if (hasScheduledBake) summary.push(`🧑🍳 ${Object.keys(scheduledBakes).map(bk => getShortName(bk)).join(', ')}`);
            if (runOutBreads && runOutBreads.length) summary.push(`🔚 ${runOutBreads.map(bk => getShortName(bk)).join(', ')}`);

            const dayLabel = `${String(day).padStart(2, '0')}/${String(currentMonth + 1).padStart(2, '0')}`;
            const isAuto = !isException;
            items.push(`
                <div data-action="open-quick-panel" data-date="${dateStr}"
                     class="calendar-list-item ${isToday ? 'ring-2 ring-bakery-accent' : ''} ${isPending ? 'bg-orange-50' : ''} cursor-pointer">
                    <span class="day-info ${isToday ? 'text-bakery-accent' : ''}">${dayLabel}${isToday ? ' · Hoy' : ''}</span>
                    <span class="flex-1 text-[10px] text-neutral-500 truncate px-2">${summary.join(' · ') || '—'}</span>
                    <span class="text-[8px] font-bold ${isException ? 'text-bakery-accent' : 'text-neutral-300'}">${isAuto ? '⚙️' : '📌'}</span>
                </div>
            `);
        }
        list.innerHTML = items.join('');
    }
}

function changeMonth(dir) {
    currentMonth += dir;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
}

function setTodayMonth() {
    const t = new Date();
    currentYear = t.getFullYear();
    currentMonth = t.getMonth();
    renderCalendar();
}

/* ==========================================================================
   PANEL RÁPIDO (slide panel)
   ========================================================================== */

function openQuickPanel(dateStr) {
    quickDate = dateStr;
    const plan = getEffectivePlan(dateStr);
    const isException = state.plans[dateStr] && state.plans[dateStr].isException;
    const [y, m, d] = dateStr.split('-');
    const title = document.getElementById('quick-panel-title');
    const sub = document.getElementById('quick-panel-sub');
    if (title) title.textContent = `Editar ${d}/${m}/${y}`;
    if (sub) {
        sub.innerHTML = isException
            ? `<span class="badge badge-warn">📌 Excepción manual</span> Modifica los consumos.`
            : 'Modifica los consumos (se creará una excepción manual).';
    }

    const container = document.getElementById('quick-panel-services');
    if (!container) return;
    container.innerHTML = '';

    const activeKeys = getActiveBreadKeys();
    SERVICES_CONFIG.forEach(svcConf => {
        const svc = plan[svcConf.key] || { active: false, bread: {} };
        const div = document.createElement('div');
        div.className = 'service-group';
        let breadHtml = '';
        activeKeys.forEach(bk => {
            const val = svc.bread ? (svc.bread[bk] || 0) : 0;
            breadHtml += `
                <label>
                    <span>${getShortName(bk)}</span>
                    <input type="number" min="0" value="${val}"
                           data-bread="${bk}" data-svc="${svcConf.key}"
                           class="svc-bread-input input-number">
                </label>
            `;
        });
        div.innerHTML = `
            <div class="svc-header">
                <span class="svc-name">${svcConf.icon} ${svcConf.name}</span>
                <label class="flex items-center gap-1 text-[10px]">
                    <input type="checkbox" class="svc-active-toggle" data-svc="${svcConf.key}" ${svc.active ? 'checked' : ''}>
                    <span class="text-neutral-500">Activo</span>
                </label>
            </div>
            <div class="svc-breads">${breadHtml}</div>
        `;
        container.appendChild(div);
    });

    loadCommentsForDate(dateStr);
    const panel = document.getElementById('quick-panel');
    if (panel) panel.classList.add('open');
}

function closeQuickPanel() {
    const panel = document.getElementById('quick-panel');
    if (panel) panel.classList.remove('open');
}

function saveQuickPlan() {
    const dateStr = quickDate;
    if (!state.plans[dateStr]) state.plans[dateStr] = {};
    state.plans[dateStr].isException = true;
    state.plans[dateStr].services = {};
    let summary = [];
    const activeKeys = getActiveBreadKeys();
    const serviceGroups = document.querySelectorAll('.service-group');
    serviceGroups.forEach(group => {
        const svcKey = group.querySelector('.svc-active-toggle').dataset.svc;
        const toggle = group.querySelector('.svc-active-toggle');
        const isActive = toggle.checked;
        state.plans[dateStr].services[svcKey] = { active: isActive, bread: {} };
        activeKeys.forEach(bk => {
            const inp = group.querySelector(`[data-bread="${bk}"]`);
            const val = inp ? (parseInt(inp.value) || 0) : 0;
            state.plans[dateStr].services[svcKey].bread[bk] = isActive ? val : 0;
        });
        if (isActive) {
            const svcConf = SERVICES_CONFIG.find(s => s.key === svcKey);
            if (svcConf) {
                const details = Object.entries(state.plans[dateStr].services[svcKey].bread)
                    .filter(([, q]) => q > 0)
                    .map(([bk, q]) => `${q} ${getShortName(bk)}`)
                    .join(', ');
                summary.push(details ? `${svcConf.name} (${details})` : svcConf.name);
            }
        }
    });
    const [, m, d] = dateStr.split('-');
    logActivity(summary.length
        ? `planificó excepción el ${d}/${m}: ${summary.join(' + ')}`
        : `vació la planificación del ${d}/${m}`);

    saveStateToCloud().then(() => {
        if (dateStr <= state.lastProcessedDate) {
            recalculateStockFrom(dateStr).then(() => {
                closeQuickPanel();
                renderAll();
            });
        } else {
            closeQuickPanel();
            renderAll();
        }
    }).catch(() => {
        closeQuickPanel();
        renderAll();
    });
}

/* ==========================================================================
   MODALES: REGLAS SEMANALES
   ========================================================================== */

function renderWeeklyRules() {
    const container = document.getElementById('weekly-rules-container');
    if (!container) return;
    container.innerHTML = '';
    const activeKeys = getActiveBreadKeys();
    const cols = SERVICES_CONFIG.map(svcConf => {
        const colDiv = document.createElement('div');
        colDiv.className = 'weekly-service-col';
        let html = `<h4>${svcConf.icon} ${svcConf.name}</h4>`;
        for (let dow = 0; dow <= 6; dow++) {
            const dayData = state.weeklyRules[dow] || {};
            const svc = dayData[svcConf.key] || { active: false, bread: {} };
            const isActive = svc.active;
            html += `
                <div class="weekly-day-row">
                    <span class="day-label">${DAY_NAMES_SHORT[dow]}</span>
                    <div class="day-breads">
                        <label class="flex items-center gap-1 text-[10px] font-bold text-neutral-500">
                            <input type="checkbox" class="weekly-svc-toggle" data-dow="${dow}" data-svc="${svcConf.key}" ${isActive ? 'checked' : ''}>
                            <span>Activo</span>
                        </label>
                        ${activeKeys.map(bk => {
                const val = svc.bread && svc.bread[bk] ? svc.bread[bk] : 0;
                return `<label><span>${getShortName(bk)}</span><input type="number" class="weekly-bread-input input-number" data-dow="${dow}" data-svc="${svcConf.key}" data-bread="${bk}" value="${val}" min="0" ${isActive ? '' : 'disabled'}></label>`;
            }).join('')}
                    </div>
                </div>
            `;
        }
        colDiv.innerHTML = html;
        return colDiv;
    });
    const gridDiv = document.createElement('div');
    gridDiv.className = 'weekly-rules-grid';
    cols.forEach(col => gridDiv.appendChild(col));
    container.appendChild(gridDiv);
}

function saveWeeklyRules() {
    const activeKeys = getActiveBreadKeys();
    for (let dow = 0; dow <= 6; dow++) {
        if (!state.weeklyRules[dow]) state.weeklyRules[dow] = {};
        SERVICES_CONFIG.forEach(svcConf => {
            const toggle = document.querySelector(
                `.weekly-svc-toggle[data-dow="${dow}"][data-svc="${svcConf.key}"]`);
            const isActive = toggle ? toggle.checked : false;
            if (!state.weeklyRules[dow][svcConf.key]) state.weeklyRules[dow][svcConf.key] = { active: false, bread: {} };
            state.weeklyRules[dow][svcConf.key].active = isActive;
            if (!state.weeklyRules[dow][svcConf.key].bread) state.weeklyRules[dow][svcConf.key].bread = {};
            const inputs = document.querySelectorAll(
                `.weekly-bread-input[data-dow="${dow}"][data-svc="${svcConf.key}"]`);
            inputs.forEach(inp => {
                const bk = inp.dataset.bread;
                state.weeklyRules[dow][svcConf.key].bread[bk] = (isActive && activeKeys.includes(bk))
                    ? (parseInt(inp.value) || 0) : 0;
            });
        });
    }
    logActivity(`actualizó las reglas fijas de toda la semana`);
    closeModal('modal-weekly-rules');
    saveStateToCloud();
    renderAll();
}

/* ==========================================================================
   MODALES: PRODUCTOS
   ========================================================================== */

function renderProductsList() {
    const container = document.getElementById('products-list-container');
    if (!container) return;
    container.innerHTML = '';
    const allKeys = Object.keys(state.stock);
    allKeys.forEach(key => {
        const config = getBreadConfig(key);
        const isCustom = !!state.customProducts[key];
        const settings = state.productSettings[key] || { enabled: true, margin: 5 };
        const margin = settings.margin || 5;
        const enabled = settings.enabled !== false;
        container.innerHTML += `
            <div class="product-list-item">
                <div class="product-info">
                    <p class="product-name">${safeHTML(config.name)}</p>
                    <p class="product-meta">${config.type || 'Personalizado'} · Lote: ${config.defaultBatch || 20}</p>
                </div>
                <div class="product-controls">
                    <label class="flex items-center gap-1 text-[10px] font-bold text-neutral-500">
                        Margen
                        <input type="number" class="margin-input product-margin-input" data-key="${key}" value="${margin}" min="0">
                    </label>
                    <label class="flex items-center gap-1 text-[10px] font-bold text-neutral-500 cursor-pointer">
                        <input type="checkbox" class="product-enabled-toggle" data-key="${key}" ${enabled ? 'checked' : ''}>
                        ${enabled ? '🟢 Activo' : '⛔ Inactivo'}
                    </label>
                    ${isCustom ? `<button data-action="remove-custom-product" data-key="${key}" class="text-red-500 hover:text-red-700 text-sm font-bold" aria-label="Eliminar ${safeHTML(config.name)}">✕</button>` : ''}
                </div>
            </div>
        `;
    });
}

function toggleProductEnabledFromCheckbox(chk) {
    const key = chk.dataset.key;
    if (!state.productSettings[key]) state.productSettings[key] = { enabled: true, margin: 5 };
    state.productSettings[key].enabled = chk.checked;
}

function saveProductSettings() {
    document.querySelectorAll('.product-margin-input').forEach(inp => {
        const key = inp.dataset.key;
        const val = parseInt(inp.value) || 5;
        if (!state.productSettings[key]) state.productSettings[key] = { enabled: true, margin: 5 };
        state.productSettings[key].margin = val;
        if (state.stock[key]) state.stock[key].margin = val;
    });
    document.querySelectorAll('.product-enabled-toggle').forEach(chk => {
        toggleProductEnabledFromCheckbox(chk);
    });
    logActivity(`actualizó la configuración de productos`);
    closeModal('modal-products');
    saveStateToCloud();
    renderAll();
}

function addCustomProduct() {
    const name = document.getElementById('new-product-name').value.trim();
    const type = document.getElementById('new-product-type').value;
    const batch = parseInt(document.getElementById('new-product-batch').value) || 20;
    if (!name) return;
    const key = 'custom_' + name.toLowerCase().replace(/\s/g, '_') + '_' + Date.now();
    state.customProducts[key] = { name, type, defaultBatch: batch };
    state.stock[key] = { qty: 0, margin: 5 };
    state.productSettings[key] = { enabled: true, margin: 5 };
    state.tempBatchInputs[key] = batch;
    logActivity(`añadió un nuevo producto: ${name}`);
    document.getElementById('new-product-name').value = '';
    renderProductsList();
    saveStateToCloud();
    renderAll();
}

function removeCustomProduct(key) {
    if (!confirm(`¿Eliminar "${getBreadConfig(key).name}"?`)) return;
    delete state.customProducts[key];
    delete state.stock[key];
    delete state.productSettings[key];
    delete state.tempBatchInputs[key];
    logActivity(`eliminó el producto personalizado ${getBreadConfig(key).name}`);
    saveStateToCloud();
    renderProductsList();
    renderAll();
}

/* ==========================================================================
   ACTIVIDAD / LOG
   ========================================================================== */

function logActivity(text) {
    if (!activityRef) return;
    activityRef.push({
        user: currentUserName || 'Alguien',
        text: text,
        ts: firebase.database.ServerValue.TIMESTAMP
    }).catch(() => {});
}

function renderActivityLog(entries) {
    lastActivityEntries = entries;
    const list = document.getElementById('activity-log-list');
    if (!list) return;
    if (!entries.length) {
        list.innerHTML = '<p class="text-xs text-neutral-400 text-center py-6">Sin actividad.</p>';
        return;
    }
    list.innerHTML = entries.map(e => `
        <div class="activity-item">
            <span class="user-avatar">👤</span>
            <div class="activity-text">
                <p class="text-neutral-700 break-words"><span class="font-bold text-bakery-primary">${safeHTML(e.user)}</span> ${safeHTML(e.text)}</p>
                <p class="text-[9px] text-neutral-400 mt-0.5">${timeAgo(e.ts)}</p>
            </div>
        </div>
    `).join('');
}

function openActivityModal() {
    openModal('modal-activity');
    renderActivityLog(lastActivityEntries);
}

/* ==========================================================================
   IDENTIDAD DE USUARIO
   ========================================================================== */

function updateUserNameButton() {
    const label = document.getElementById('btn-user-name-label');
    if (label) label.textContent = currentUserName || 'Identificarme';
}

function ensureUserName() {
    updateUserNameButton();
    if (!currentUserName) openNameModal();
}

function openNameModal() {
    document.getElementById('input-user-name').value = currentUserName;
    openModal('modal-name');
}

function saveUserName() {
    const val = document.getElementById('input-user-name').value.trim();
    if (val) {
        currentUserName = val.slice(0, 24);
        localStorage.setItem('panaderia_user_name', currentUserName);
        updateUserNameButton();
    }
    closeModal('modal-name');
}

/* ==========================================================================
   SINCRONIZACIÓN EN TIEMPO REAL
   ========================================================================== */

function initRealtimeSync() {
    if (!db) return;

    db.ref('.info/connected').on('value', snap => {
        const status = document.getElementById('sync-status');
        if (!status) return;
        if (snap.val()) {
            status.textContent = '🟢 Sincronizado';
            status.className = 'sync-badge ok';
        } else {
            status.textContent = '🔴 Offline';
            status.className = 'sync-badge offline';
        }
    });

    stateRef.on('value', snapshot => {
        const cloudData = snapshot.val();
        if (cloudData) {
            isApplyingRemoteUpdate = true;
            mergeCloudStates(cloudData);
            isApplyingRemoteUpdate = false;
        } else if (!firstSnapshotReceived) {
            saveStateToCloud();
        }
        firstSnapshotReceived = true;
        processAutoDepletions();
        checkPendingHarvests();
        renderAll();
        const timeEl = document.getElementById('last-updated-time');
        if (timeEl) timeEl.textContent = `Última actualización: ${new Date().toLocaleTimeString()}`;
    });

    activityRef.limitToLast(30).on('value', (snapshot) => {
        const entries = [];
        snapshot.forEach(child => { entries.push(child.val()); });
        entries.reverse();
        renderActivityLog(entries);
    });
}

function mergeCloudStates(parsed) {
    if (parsed.stock) Object.keys(parsed.stock).forEach(k => {
        if (!state.stock[k]) state.stock[k] = { qty: 0, margin: 5 };
        state.stock[k] = parsed.stock[k];
    });
    if (parsed.plans) state.plans = parsed.plans || {};
    if (parsed.weeklyRules) state.weeklyRules = parsed.weeklyRules;
    if (parsed.lastProcessedDate) state.lastProcessedDate = parsed.lastProcessedDate;
    if (parsed.tempBatchInputs) state.tempBatchInputs = parsed.tempBatchInputs;
    if (parsed.productSettings) state.productSettings = parsed.productSettings;
    if (parsed.customProducts) state.customProducts = parsed.customProducts;
    if (parsed.bakeSchedule) state.bakeSchedule = parsed.bakeSchedule;

    Object.keys(DEFAULT_BREADS).forEach(k => {
        if (!state.stock[k]) state.stock[k] = { qty: 0, margin: 5 };
        if (!state.productSettings[k]) state.productSettings[k] = { enabled: true, margin: 5 };
    });
    for (let i = 0; i <= 6; i++) {
        if (!state.weeklyRules[i]) state.weeklyRules[i] = {};
        SERVICES_CONFIG.forEach(s => {
            if (!state.weeklyRules[i][s.key]) state.weeklyRules[i][s.key] = { active: false, bread: {} };
        });
    }
}

function saveStateToCloud() {
    if (isApplyingRemoteUpdate) return Promise.resolve();
    const status = document.getElementById('sync-status');
    if (status) {
        status.textContent = '⏳ Guardando...';
        status.className = 'sync-badge saving';
    }
    return stateRef.set(state).then(() => {
        if (status) {
            status.textContent = '🟢 Sincronizado';
            status.className = 'sync-badge ok';
        }
    }).catch(() => {
        if (status) {
            status.textContent = '⚠️ Error';
            status.className = 'sync-badge offline';
        }
    });
}

/* ==========================================================================
   RENDER TODAY SUMMARY
   ========================================================================== */

function renderTodaySummary() {
    const container = document.getElementById('today-summary');
    if (!container) return;
    const todayStr = getTodayDateString();
    const plan = getEffectivePlan(todayStr);
    const proj = calculateProjections();
    const todayLabel = new Date().toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    let badges = [];
    SERVICES_CONFIG.forEach(s => {
        const svc = plan[s.key];
        if (svc && svc.active) {
            let details = [];
            if (svc.bread) Object.entries(svc.bread).forEach(([bk, qty]) => {
                if (qty > 0 && state.productSettings[bk] && state.productSettings[bk].enabled !== false) {
                    details.push(`${qty} ${getShortName(bk)}`);
                }
            });
            if (details.length) {
                badges.push(`<span class="today-badge bg-amber-50 text-amber-700 border-amber-200">${s.icon} ${s.name}: ${details.join(', ')}</span>`);
            }
        }
    });

    const criticalToday = proj.orders.filter(o => o.date === todayStr).map(o => getShortName(o.bread));
    if (criticalToday.length) {
        badges.push(`<span class="today-badge bg-red-50 text-red-700 border-red-200">🥣 Toca amasar hoy: ${criticalToday.join(', ')}</span>`);
    }

    const criticalNow = Object.entries(state.stock).filter(([k, i]) => {
        const settings = state.productSettings[k];
        if (!settings || settings.enabled === false) return false;
        const margin = settings.margin || 5;
        return i.qty <= margin;
    }).map(([k]) => getShortName(k));
    if (criticalNow.length) {
        badges.push(`<span class="today-badge bg-red-50 text-red-700 border-red-200">⚠️ Bajo mínimos: ${criticalNow.join(', ')}</span>`);
    }

    const todayBakes = getScheduledBakesForDate(todayStr);
    if (Object.keys(todayBakes).length) {
        const txt = Object.keys(todayBakes).map(bk => getShortName(bk)).join(', ');
        badges.push(`<span class="today-badge bg-blue-50 text-blue-700 border-blue-200">🧑‍🍳 Amasadora: ${txt}</span>`);
    }

    container.innerHTML = `
        <p class="text-[10px] uppercase tracking-wider font-bold text-neutral-400 mb-2">📅 Hoy · ${todayLabel}</p>
        <div class="flex flex-wrap gap-2">
            ${badges.length ? badges.join('') : '<span class="text-sm text-neutral-400">Nada planificado ni pendiente para hoy. 🎉</span>'}
        </div>
    `;
}

/* ==========================================================================
   RENDER ALL
   ========================================================================== */

function renderAll() {
    renderStock();
    renderCalendar();
    renderTodaySummary();
    checkPendingHarvests();
    updateCommentBadge();
    const prodSection = document.getElementById('view-production');
    if (prodSection && !prodSection.classList.contains('hidden')) {
        renderProductionChecklist();
    }
}

/* ==========================================================================
   INICIALIZACIÓN
   ========================================================================== */

function init() {
    console.log('🚀 Iniciando Stock & Amasado v2.5.1 — Diseño renovado');
    setupThemeModal();
    setupEventDelegation();
    initDarkMode();
    loadTheme();

    if (initFirebase()) {
        initRealtimeSync();
    } else {
        document.getElementById('sync-status').textContent = '⚠️ Firebase no disponible';
        document.getElementById('sync-status').className = 'sync-badge offline';
    }

    ensureUserName();
    renderAll();
    setTimeout(startTour, 1500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
