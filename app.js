/**
 * ═══════════════════════════════════════════════════════════════
 * KAPPO BUSINESS — app.js (VERSÃO FINAL COM CONEXÃO REAL)
 * ═══════════════════════════════════════════════════════════════
 */

// FERRAMENTAS DE FORMATAÇÃO (Dinheiro, Datas, etc)
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

// ALERTAS NA TELA (Cantinho superior)
const Toast = {
  _show(msg, type) {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 3000);
  },
  success(m) { this._show(m, 'success'); },
  error(m) { this._show(m, 'error'); }
};

// CONTROLE DE JANELAS (Modais)
const Modal = {
  open(id) {
    document.getElementById('modal-overlay').classList.remove('hidden');
    document.getElementById(id).classList.remove('hidden');
  },
  close(id) {
    document.getElementById(id).classList.add('hidden');
    document.getElementById('modal-overlay').classList.add('hidden');
  }
};

// MOTOR PRINCIPAL DA APLICAÇÃO
const App = {
  async init() {
    console.log('🚀 Sistema Iniciado');
    const session = SessionManager.verify();
    if (session) {
      this.showApp(session.sub);
    }
    this.bindEvents();
  },

  showApp(userName) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('sidebar-username').innerText = userName;
    this.loadView('dashboard');
  },

  bindEvents() {
    // 1. AÇÃO DE LOGIN
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
      btnLogin.onclick = async () => {
        const user = document.getElementById('login-user').value;
        const pass = document.getElementById('login-pass').value;
        const success = await DB.login(user, pass);
        if (success) { this.showApp(user); Toast.success("Bem-vindo!"); }
        else { Toast.error("Usuário ou senha inválidos."); }
      };
    }

    // 2. NAVEGAÇÃO DO MENU
    document.querySelectorAll('.nav-item').forEach(link => {
      link.onclick = (e) => {
        const page = e.currentTarget.getAttribute('data-page');
        if (page === 'logout') { SessionManager.destroy(); window.location.reload(); }
        else if (page) { this.loadView(page); }
      };
    });

    // 3. BOTÕES QUE ABREM MODAIS (Ex: "Novo Cliente")
    document.querySelectorAll('[data-modal]').forEach(btn => {
      btn.onclick = () => Modal.open(btn.getAttribute('data-modal'));
    });

    // 4. LÓGICA DE SALVAR CLIENTE (O que você pediu!)
    const btnSalvarCli = document.getElementById('btn-save-cliente');
    if (btnSalvarCli) {
      btnSalvarCli.onclick = async () => {
        const dados = {
          nome: document.getElementById('cli-nome').value,
          whatsapp: document.getElementById('cli-whatsapp').value,
          email: document.getElementById('cli-email').value,
          dia_vencimento: parseInt(document.getElementById('cli-vencimento').value) || 10,
          valor_mensalidade: parseFloat(document.getElementById('cli-valor').value) || 0,
          status: 'ativo'
        };

        if (!dados.nome) return Toast.error("Digite o nome do cliente!");

        btnSalvarCli.innerText = "⏳ SALVANDO...";
        const resultado = await DB.salvarCliente(dados);
        
        if (resultado) {
          Toast.success("Cliente cadastrado com sucesso!");
          Modal.close('modal-cliente');
          ClientesPage.init(); // Atualiza a lista de clientes
          this.updateDashboard(); // Atualiza os números do painel
        }
        btnSalvarCli.innerText = "💾 Salvar Cliente";
      };
    }

    // 5. LÓGICA DE SALVAR TRANSAÇÃO (Financeiro)
    const btnSalvarTx = document.getElementById('btn-salvar-transacao');
    if (btnSalvarTx) {
      btnSalvarTx.onclick = async () => {
        const dados = {
          descricao: document.getElementById('tx-desc').value,
          tipo: document.getElementById('tx-tipo').value,
          categoria: document.getElementById('tx-cat').value,
          valor: parseFloat(document.getElementById('tx-valor').value) || 0,
          data: Utils.today()
        };

        const res = await DB.salvarTransacao(dados);
        if (res) {
          Toast.success("Lançamento financeiro realizado!");
          Modal.close('modal-transacao');
          FinanceiroPage.init();
          this.updateDashboard();
        }
      };
    }
  },

  loadView(view) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    
    const target = document.getElementById(`page-${view}`);
    if (target) target.classList.add('active');
    
    const nav = document.querySelector(`.nav-item[data-page="${view}"]`);
    if (nav) nav.classList.add('active');

    // Carrega os dados do banco para cada tela
    if (view === 'dashboard') this.updateDashboard();
    if (view === 'clientes') ClientesPage.init();
    if (view === 'financeiro') FinanceiroPage.init();
  },

  async updateDashboard() {
    const clientes = await DB.getClientes();
    const transacoes = await DB.getTransacoes();

    // Calcula os números do topo
    document.getElementById('val-clientes').innerText = clientes.length;
    
    const totalReceita = transacoes
      .filter(t => t.tipo === 'entrada')
      .reduce((sum, t) => sum + t.valor, 0);
    
    document.getElementById('val-faturamento').innerText = Utils.formatCurrency(totalReceita);
  }
};

// LÓGICA DA PÁGINA DE CLIENTES
const ClientesPage = {
  async init() {
    const tbody = document.getElementById('tbody-clientes');
    tbody.innerHTML = '<tr><td colspan="8">Carregando dados...</td></tr>';
    
    const dados = await DB.getClientes();
    
    if (dados.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Nenhum cliente no banco.</td></tr>';
      return;
    }

    tbody.innerHTML = dados.map(cli => `
      <tr>
        <td><strong>${cli.nome}</strong></td>
        <td>${Utils.formatPhone(cli.whatsapp)}</td>
        <td>Vence dia ${cli.dia_vencimento}</td>
        <td>${Utils.formatCurrency(cli.valor_mensalidade)}</td>
        <td><span class="badge badge-success">${cli.status}</span></td>
        <td>
          <button class="btn-icon" onclick="Toast.error('Função em desenvolvimento')">✏️</button>
        </td>
      </tr>
    `).join('');
  }
};

// LÓGICA DA PÁGINA FINANCEIRA
const FinanceiroPage = {
  async init() {
    const tbody = document.getElementById('tbody-financeiro');
    const dados = await DB.getTransacoes();
    
    tbody.innerHTML = dados.map(t => `
      <tr>
        <td>${Utils.formatDate(t.data)}</td>
        <td>${t.descricao}</td>
        <td>${t.categoria}</td>
        <td class="${t.tipo === 'entrada' ? 'text-green' : 'text-red'}">
          ${t.tipo === 'entrada' ? '+' : '-'} ${Utils.formatCurrency(t.valor)}
        </td>
      </tr>
    `).join('');
  }
};

// Inicializa tudo ao carregar a página
window.onload = () => App.init();