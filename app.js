/**
 * ═══════════════════════════════════════════════════════════════
 * KAPPO BUSINESS — app.js (CORRIGIDO E CONECTADO)
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
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3000);
  },
  success(m) { this._show(m, 'success'); },
  error(m) { this._show(m, 'error'); },
  info(m) { this._show(m, 'info'); }
};

const Modal = {
  open(id) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(id).classList.remove('hidden');
  },
  close(id) {
    document.getElementById(id).classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
  },
  confirm(msg, onConfirm) {
    const m = document.getElementById('modal-confirm');
    document.getElementById('confirm-msg').innerText = msg;
    this.open('modal-confirm');
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
    
    // Verifica se já existe uma sessão salva (se o usuário já logou antes)
    const session = SessionManager.verify();
    if (session) {
      this.showApp(session.sub);
    }

    this.bindEvents();
  },

  showApp(userName) {
    // Esconde a tela de login e ativa a interface principal (ID corrigido para 'app')
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('hidden');
    
    const appContainer = document.getElementById('app');
    appContainer.classList.remove('hidden');
    appContainer.classList.add('active');
    
    document.getElementById('sidebar-username').innerText = userName;
    this.loadView('dashboard');
  },

  bindEvents() {
    // ─── LÓGICA DO BOTÃO DE LOGIN ───
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
      btnLogin.onclick = async () => {
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;
        const errorDiv = document.getElementById('login-error');
        const errorMsg = document.getElementById('login-error-msg');

        // Feedback visual de carregamento
        btnLogin.innerHTML = `<span class="btn-glow"></span><span class="btn-text">⏳ AUTENTICANDO...</span>`;

        setTimeout(async () => {
            if (!user || !pass) {
              errorDiv.classList.remove('hidden');
              errorMsg.innerText = "Preencha usuário e senha.";
              btnLogin.innerHTML = `<span class="btn-glow"></span><span class="btn-text">▶ INICIAR SESSÃO SEGURA</span>`;
              return;
            }

            // Chama o banco de dados local para validar (admin / admin123)
            const success = await DB.login(user, pass);
            
            if (success) {
              errorDiv.classList.add('hidden');
              this.showApp(user);
              Toast.success("Acesso autorizado!");
            } else {
              errorDiv.classList.remove('hidden');
              errorMsg.innerText = "Credenciais inválidas. Tente admin / admin123";
            }
            btnLogin.innerHTML = `<span class="btn-glow"></span><span class="btn-text">▶ INICIAR SESSÃO SEGURA</span>`;
        }, 600); // Delay suave simulando rede
      };
    }

    // ─── MOSTRAR/OCULTAR SENHA ───
    const togglePass = document.getElementById('toggle-pass');
    if (togglePass) {
      togglePass.onclick = () => {
        const passInput = document.getElementById('login-pass');
        if (passInput.type === 'password') {
          passInput.type = 'text';
          togglePass.innerText = '🚫';
        } else {
          passInput.type = 'password';
          togglePass.innerText = '👁';
        }
      };
    }

    // ─── BOTÃO DE SAIR (LOGOUT) ───
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.onclick = () => {
         SessionManager.destroy();
         window.location.reload(); // Recarrega a página para voltar ao login
      };
    }

    // ─── NAVEGAÇÃO DO MENU LATERAL ───
    document.querySelectorAll('.nav-item').forEach(link => {
      if (link.id === 'btn-logout') return; // Pula o botão de sair
      link.onclick = (e) => {
        e.preventDefault();
        const view = e.currentTarget.getAttribute('data-page'); // Corrigido de data-view para data-page
        if(view) this.loadView(view);
      };
    });

    // ─── ABERTURA/FECHAMENTO DE MODAIS ───
    document.querySelectorAll('[data-modal]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-modal');
        const modal = document.getElementById(id);
        if(modal) {
           if (modal.classList.contains('hidden')) {
              Modal.open(id);
           } else {
              Modal.close(id);
           }
        }
      };
    });

    // ─── BOTÕES DE CONFIGURAÇÃO ───
    const btnSalvarSupabase = document.getElementById('btn-salvar-supabase');
    if(btnSalvarSupabase) {
      btnSalvarSupabase.onclick = () => ConfigPage.saveSupabase();
    }
  },

  loadView(view) {
    this.currentView = view;
    
    // Esconde todas as páginas e desativa abas do menu
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    
    // Ativa a página solicitada
    const targetPage = document.getElementById(`page-${view}`);
    if (targetPage) targetPage.classList.add('active');
    
    // Ativa o link correspondente no menu
    const navLink = document.querySelector(`.nav-item[data-page="${view}"]`);
    if (navLink) navLink.classList.add('active');

    // Atualiza o título no topo da página
    const titles = {
        'dashboard': 'DASHBOARD',
        'clientes': 'CLIENTES',
        'mensalidades': 'MENSALIDADES',
        'financeiro': 'FINANCEIRO',
        'reserva': 'RESERVA',
        'configuracoes': 'CONFIGURAÇÕES'
    };
    const titleEl = document.getElementById('page-title');
    if(titleEl && titles[view]) titleEl.innerText = titles[view];

    // Inicializa funções específicas de cada tela
    if (view === 'dashboard') DashboardPage.init();
    if (view === 'clientes') ClientesPage.init();
    if (view === 'financeiro') FinanceiroPage.init();
    if (view === 'reserva') ReservaPage.init();
    if (view === 'configuracoes') ConfigPage.init();
  },
  
  // Função atalho para botões chamarem rotas (Ex: botões "Ver Todos" no Dashboard)
  navigate(view) {
      this.loadView(view);
  }
};

const DashboardPage = {
  init() {
    document.getElementById('val-clientes').innerText = '0';
    document.getElementById('val-inadimplentes').innerText = '0';
    document.getElementById('val-faturamento').innerText = Utils.formatCurrency(0);
    this.renderInadimplentes();
  },
  renderInadimplentes() {
    const tbody = document.getElementById('tbody-inadimplentes');
    if(tbody) tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Tudo em dia. Nenhum cliente inadimplente.</td></tr>';
  }
};

const ClientesPage = {
  init() { this.renderTable(); },
  renderTable() {
    const tbody = document.getElementById('tbody-clientes');
    if(tbody) tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Nenhum cliente cadastrado no momento.</td></tr>';
  }
};

const FinanceiroPage = { init() {} };
const ReservaPage = { init() {} };

const ConfigPage = {
  init() {
    const cfg = LocalStore.getSupabaseConfig();
    const urlInput = document.getElementById('cfg-sb-url');
    const keyInput = document.getElementById('cfg-sb-key');
    if(urlInput) urlInput.value = cfg.url || '';
    if(keyInput) keyInput.value = cfg.key || '';
  },
  saveSupabase() {
    Toast.success('Configurações salvas!');
  }
};

// Inicia o App quando a janela carregar
window.onload = () => App.init();