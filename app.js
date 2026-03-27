const Utils = {
  currency: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
};

const App = {
  init() {
    const isLogged = localStorage.getItem('_kappo_session');
    if (isLogged) {
      this.showApp();
    } else {
      this.setupLogin();
    }
  },

  setupLogin() {
    const btn = document.getElementById('btn-login');
    if (btn) {
      btn.onclick = async () => {
        const u = document.getElementById('login-user').value;
        const p = document.getElementById('login-pass').value;
        if (await DB.login(u, p)) {
          this.showApp();
        } else {
          alert("Usuário ou Senha incorretos!");
        }
      };
    }
  },

  showApp() {
    // Esconde a tela de login e mostra o app
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('sidebar-username').innerText = 'Admin';
    
    this.loadPage('dashboard');
    this.setupMenus();
  },

  setupMenus() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.onclick = () => {
        const page = item.getAttribute('data-page');
        if (page === 'logout') {
          localStorage.clear();
          location.reload();
        } else {
          this.loadPage(page);
        }
      };
    });
  },

  async loadPage(page) {
    // Muda a aba ativa
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`page-${page}`).classList.add('active');
    const nav = document.querySelector(`[data-page="${page}"]`);
    if (nav) nav.classList.add('active');

    // Carrega os dados
    if (page === 'dashboard') this.updateDashboard();
    if (page === 'clientes') this.updateClientes();
  },

  async updateDashboard() {
    const clis = await DB.getClientes();
    const fins = await DB.getFinanceiro();

    const elC = document.getElementById('stat-clientes');
    const elR = document.getElementById('stat-receita');

    if (elC) elC.innerText = clis.length;
    if (elR) {
      const total = fins.filter(t => t.tipo === 'entrada').reduce((a, b) => a + b.valor, 0);
      elR.innerText = Utils.currency(total);
    }
  },

  async updateClientes() {
    const list = document.getElementById('clientes-list');
    if (!list) return;
    list.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    
    const dados = await DB.getClientes();
    if (dados.length === 0) {
      list.innerHTML = '<tr><td colspan="5">Nenhum cliente no banco de dados.</td></tr>';
      return;
    }

    list.innerHTML = dados.map(c => `
      <tr>
        <td>${c.nome}</td>
        <td>${c.whatsapp || '-'}</td>
        <td>${Utils.currency(c.valor_mensalidade)}</td>
        <td><span class="badge badge-success">Ativo</span></td>
        <td><button class="btn-icon">✏️</button></td>
      </tr>
    `).join('');
  }
};

// Inicia o sistema
window.onload = () => App.init();