/**
 * ═══════════════════════════════════════════════════════════════
 * KAPPO BUSINESS — app.js (VERSÃO FINAL BLINDADA)
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
    return phone || '—';
  },
  today() { return new Date().toISOString().split('T')[0]; }
};

const Toast = {
  _show(msg, type) {
    const container = document.getElementById('toast-container');
    if (!container) return alert(msg);
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3000);
  },
  success(m) { this._show(m, 'success'); },
  error(m) { this._show(m, 'error'); }
};

const Modal = {
  open(id) {
    const overlay = document.getElementById('modal-overlay');
    const target = document.getElementById(id);
    if (overlay) overlay.classList.remove('hidden');
    if (target) target.classList.remove('hidden');
  },
  close(id) {
    const overlay = document.getElementById('modal-overlay');
    const target = document.getElementById(id);
    if (overlay) overlay.classList.add('hidden');
    if (target) target.classList.add('hidden');
  }
};

const App = {
  async init() {
    console.log('🚀 Iniciando App...');
    const session = SessionManager.verify();
    if (session) {
      this.showApp(session.sub);
    }
    this.bindEvents();
  },

  showApp(userName) {
    const loginScreen = document.getElementById('login-screen');
    const appScreen = document.getElementById('app');
    const userDisplay = document.getElementById('sidebar-username');

    if (loginScreen) loginScreen.classList.add('hidden');
    if (appScreen) appScreen.classList.remove('hidden');
    if (userDisplay) userDisplay.innerText = userName;
    
    // Força ir para o dashboard
    this.loadView('dashboard');
  },

  bindEvents() {
    // Login
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
      btnLogin.onclick = async () => {
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;
        const success = await DB.login(user, pass);
        if (success) { this.showApp(user); }
        else { Toast.error("Usuário ou senha inválidos."); }
      };
    }

    // Navegação do Menu
    document.querySelectorAll('.nav-item').forEach(link => {
      link.onclick = (e) => {
        const page = e.currentTarget.getAttribute('data-page');
        if (page === 'logout') { 
            SessionManager.destroy(); 
            window.location.reload(); 
        } else if (page) { 
            this.loadView(page); 
        }
      };
    });

    // Fechar modais ao clicar no X ou Cancelar
    document.querySelectorAll('[data-modal]').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-modal');
            const modal = document.getElementById(id);
            if (modal && !modal.classList.contains('hidden')) {
                Modal.close(id);
            } else {
                Modal.open(id);
            }
        };
    });

    // Botão Salvar Cliente
    const btnSalvarCli = document.getElementById('btn-save-cliente');
    if (btnSalvarCli) {
      btnSalvarCli.onclick = async () => {
        const nomeCli = document.getElementById('cli-nome').value;
        if (!nomeCli) return Toast.error("Nome é obrigatório!");

        const dados = {
          nome: nomeCli,
          whatsapp: document.getElementById('cli-whatsapp').value,
          dia_vencimento: parseInt(document.getElementById('cli-vencimento').value) || 10,
          valor_mensalidade: parseFloat(document.getElementById('cli-valor').value) || 0,
          status: 'ativo'
        };

        btnSalvarCli.innerText = "⏳ SALVANDO...";
        const res = await DB.salvarCliente(dados);
        if (res) {
          Toast.success("Cliente salvo!");
          Modal.close('modal-cliente');
          ClientesPage.init();
          this.updateDashboard();
        }
        btnSalvarCli.innerText = "💾 Salvar Cliente";
      };
    }
  },

  loadView(view) {
    console.log('Cambiando para:', view);
    // 1. Esconde todas as páginas
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    // 2. Desmarca todos os itens do menu
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    
    // 3. Ativa a página certa
    const targetPage = document.getElementById(`page-${view}`);
    if (targetPage) targetPage.classList.add('active');
    
    // 4. Marca o menu certo
    const navItem = document.querySelector(`.nav-item[data-page="${view}"]`);
    if (navItem) navItem.classList.add('active');

    // 5. Roda a função da página
    if (view === 'dashboard') this.updateDashboard();
    if (view === 'clientes') ClientesPage.init();
    if (view === 'financeiro') FinanceiroPage.init();
  },

  async updateDashboard() {
    try {
        const clientes = await DB.getClientes() || [];
        const transacoes = await DB.getTransacoes() || [];

        // Atualiza os cards (usa IDs flexíveis para evitar erro)
        const elCli = document.getElementById('val-clientes') || document.getElementById('stat-clientes');
        const elFin = document.getElementById('val-faturamento') || document.getElementById('stat-receita');

        if (elCli) elCli.innerText = clientes.length;
        if (elFin) {
            const total = transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + t.valor, 0);
            elFin.innerText = Utils.formatCurrency(total);
        }
    } catch (e) {
        console.error("Erro dashboard:", e);
    }
  }
};

const ClientesPage = {
  async init() {
    const tbody = document.getElementById('tbody-clientes') || document.getElementById('clientes-list');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="8">Buscando no banco...</td></tr>';
    const dados = await DB.getClientes();
    
    if (!dados || dados.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Nenhum cliente encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = dados.map(cli => `
      <tr>
        <td><strong>${cli.nome}</strong></td>
        <td>${Utils.formatPhone(cli.whatsapp)}</td>
        <td>Dia ${cli.dia_vencimento}</td>
        <td>${Utils.formatCurrency(cli.valor_mensalidade)}</td>
        <td><span class="badge badge-success">${cli.status}</span></td>
        <td><button class="btn-icon">✏️</button></td>
      </tr>
    `).join('');
  }
};

const FinanceiroPage = {
  async init() {
    const tbody = document.getElementById('tbody-financeiro');
    if (!tbody) return;
    const dados = await DB.getTransacoes();
    tbody.innerHTML = (dados || []).map(t => `
      <tr>
        <td>${Utils.formatDate(t.data)}</td>
        <td>${t.descricao}</td>
        <td class="${t.tipo === 'entrada' ? 'text-green' : 'text-red'}">${Utils.formatCurrency(t.valor)}</td>
      </tr>
    `).join('');
  }
};

window.onload = () => App.init();