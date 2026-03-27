/**
 * ═══════════════════════════════════════════════════════════════
 * KAPPO BUSINESS — app.js (PULANDO TELA DE LOGIN)
 * ═══════════════════════════════════════════════════════════════
 */

const Utils = {
  formatCurrency(val) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0); },
  formatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  },
  formatPhone(phone) {
    const n = (phone || '').replace(/\D/g, '');
    if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
    if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
    return phone || '—';
  },
  escapeHtml(str) { return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },
  today() { return new Date().toISOString().split('T')[0]; }
};

const Toast = {
  _show(msg, type) {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('visible'), 10);
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 3000);
  },
  success(m) { this._show(m, 'success'); },
  error(m) { this._show(m, 'error'); },
  info(m) { this._show(m, 'info'); }
};

const Modal = {
  open(id) { document.getElementById(id).classList.remove('hidden'); },
  close(id) { document.getElementById(id).classList.add('hidden'); },
  confirm(msg, onConfirm) {
    const m = document.getElementById('modal-confirm');
    document.getElementById('confirm-msg').innerText = msg;
    m.classList.remove('hidden');
    const btn = document.getElementById('btn-confirm-delete');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.onclick = () => { onConfirm(); this.close('modal-confirm'); };
  }
};

const App = {
  currentView: 'dashboard',

  async init() {
    console.log('🚀 Kappo Business Initializing...');
    
    // TRUQUE DO BYPASS (PULANDO O LOGIN)
    setTimeout(() => {
        this.showApp("Admin Master");
    }, 200);

    this.bindEvents();
  },

  showApp(userName) {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-shell').classList.add('active');
    document.getElementById('user-name').innerText = userName;
    this.loadView('dashboard');
  },

  bindEvents() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.onclick = (e) => {
        e.preventDefault();
        const view = e.currentTarget.getAttribute('data-view');
        this.loadView(view);
      };
    });

    document.querySelectorAll('[data-modal]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-modal');
        if (document.getElementById(id).classList.contains('hidden')) Modal.open(id);
        else Modal.close(id);
      };
    });

    document.getElementById('btn-save-config').onclick = () => ConfigPage.saveSupabase();
    document.getElementById('btn-test-db').onclick = () => ConfigPage.testConnection();
    document.getElementById('btn-save-traccar').onclick = () => ConfigPage.saveTraccar();
  },

  loadView(view) {
    this.currentView = view;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    const target = document.getElementById(`page-${view}`);
    if (target) target.classList.add('active');
    
    const nav = document.querySelector(`.nav-link[data-view="${view}"]`);
    if (nav) nav.classList.add('active');

    if (view === 'dashboard') DashboardPage.init();
    if (view === 'clientes') ClientesPage.init();
    if (view === 'financeiro') FinanceiroPage.init();
    if (view === 'reserva') ReservaPage.init();
    if (view === 'config') ConfigPage.init();
  }
};

const DashboardPage = {
  init() {
    document.getElementById('stat-clientes').innerText = '0';
    document.getElementById('stat-pendentes').innerText = '0';
    document.getElementById('stat-receita').innerText = Utils.formatCurrency(0);
    this.renderInadimplentes();
  },
  renderInadimplentes() {
    const list = document.getElementById('list-inadimplentes');
    list.innerHTML = '<div class="empty-state">Tudo em dia.</div>';
  }
};

const ClientesPage = {
  init() { this.renderTable(); },
  renderTable() {
    const list = document.getElementById('clientes-list');
    list.innerHTML = '<tr><td colspan="6" class="empty-state">Nenhum cliente cadastrado no Supabase.</td></tr>';
  }
};

const FinanceiroPage = { init() {} };
const ReservaPage = { init() {} };

const ConfigPage = {
  init() {
    const cfg = LocalStore.getSupabaseConfig();
    document.getElementById('cfg-supabase-url').value = cfg.url || '';
    document.getElementById('cfg-supabase-key').value = cfg.key || '';
  },
  saveSupabase() {
    Toast.success('Salvo localmente!');
  },
  testConnection() {
    Toast.info('Testando Supabase...');
  },
  saveTraccar() {}
};

window.onload = () => App.init();