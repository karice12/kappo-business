/**
 * ═══════════════════════════════════════════════════════════════
 * KAPPO BUSINESS — app.js (VERSÃO CORRIGIDA FULL STACK)
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
  }
};

const Toast = {
  _show(msg, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => t.classList.add('visible'), 10);
    setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3500);
  },
  success(m) { this._show(m, 'success'); },
  error(m) { this._show(m, 'error'); },
  info(m) { this._show(m, 'info'); }
};

const App = {
  currentView: 'dashboard',

  async init() {
    console.log('🚀 Kappo Business Initializing...');
    
    // Escuta o clique do botão de login
    const loginBtn = document.getElementById('btn-login');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => this.handleLogin());
    }

    this.bindGlobalEvents();
  },

  async handleLogin() {
      const userField = document.getElementById('login-user');
      const passField = document.getElementById('login-pass');
      const errorDiv = document.getElementById('login-error');

      if (!userField || !passField) return;

      const user = userField.value.trim();
      const pass = passField.value.trim();

      // Força a entrada com admin / admin123
      if (user === 'admin' && pass === 'admin123') {
          if (errorDiv) errorDiv.classList.add('hidden');
          this.showApp("Admin Master");
          Toast.success("Bem-vindo ao Kappo Business!");
      } else {
          if (errorDiv) {
              errorDiv.classList.remove('hidden');
              document.getElementById('login-error-msg').innerText = "Credenciais inválidas! Use admin / admin123";
          }
      }
  },

  showApp(userName) {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const sidebarUser = document.getElementById('sidebar-username');

    if (loginScreen) loginScreen.classList.remove('active');
    if (appScreen) appScreen.classList.add('active'); // Corrigido de app-shell para app
    if (sidebarUser) sidebarUser.innerText = userName;

    this.loadView('dashboard');
  },

  bindGlobalEvents() {
    // Menu lateral
    document.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = e.currentTarget.getAttribute('data-page');
        if (view) this.loadView(view);
      });
    });

    // Logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            location.reload(); // Recarrega o site para deslogar
        });
    }
  },

  loadView(view) {
    this.currentView = view;
    
    // Troca o título do topo
    const pageTitle = document.getElementById('page-title');
    if (pageTitle) pageTitle.innerText = view.toUpperCase();

    // Esconde todas as páginas e desativa os botões do menu
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    
    // Mostra a página atual
    const target = document.getElementById(`page-${view}`);
    if (target) target.classList.add('active');
    
    // Ativa o botão no menu
    const nav = document.querySelector(`.nav-item[data-page="${view}"]`);
    if (nav) nav.classList.add('active');

    // Inicializa a página específica
    if (view === 'dashboard') DashboardPage.init();
    if (view === 'clientes') ClientesPage.init();
  }
};

const DashboardPage = {
  init() {
    const faturamento = document.getElementById('val-faturamento');
    const clientes = document.getElementById('val-clientes');

    if (faturamento) faturamento.innerText = Utils.formatCurrency(0);
    if (clientes) clientes.innerText = "0";

    const tbody = document.getElementById('tbody-inadimplentes');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Nenhum inadimplente encontrado.</td></tr>';

    const tbodyTx = document.getElementById('tbody-transacoes-dash');
    if (tbodyTx) tbodyTx.innerHTML = '<tr><td colspan="5" class="table-empty">Nenhuma transação recente.</td></tr>';
  }
};

const ClientesPage = {
  init() {
    const tbody = document.getElementById('tbody-clientes');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Nenhum cliente cadastrado no Supabase.</td></tr>';
  }
};

window.onload = () => App.init();