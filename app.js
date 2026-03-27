const Utils = {
  currency: (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0),
  today: () => new Date().toISOString().split('T')[0]
};

const App = {
  async init() {
    const user = localStorage.getItem('_session');
    if (user) {
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      this.loadDashboard();
    }
    this.setupMenus();
  },

  setupMenus() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.onclick = () => {
        const page = btn.dataset.page;
        if (page === 'logout') { localStorage.clear(); location.reload(); }
        this.showPage(page);
      };
    });

    // Botão de Login
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
      btnLogin.onclick = async () => {
        const u = document.getElementById('login-user').value;
        const p = document.getElementById('login-pass').value;
        if (await DB.login(u, p)) location.reload();
        else alert("Acesso negado!");
      };
    }
  },

  showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`page-${pageId}`).classList.add('active');
    document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

    if (pageId === 'dashboard') this.loadDashboard();
    if (pageId === 'clientes') this.loadClientes();
  },

  async loadDashboard() {
    console.log("Atualizando Dashboard...");
    const clis = await DB.getClientes();
    const fins = await DB.getFinanceiro();

    // Atualiza os números na tela
    const txtCli = document.getElementById('stat-clientes') || document.getElementById('val-clientes');
    const txtFin = document.getElementById('stat-receita') || document.getElementById('val-faturamento');

    if (txtCli) txtCli.innerText = clis.length;
    if (txtFin) {
      const total = fins.filter(t => t.tipo === 'entrada').reduce((a, b) => a + b.valor, 0);
      txtFin.innerText = Utils.currency(total);
    }
  },

  async loadClientes() {
    const list = document.getElementById('clientes-list') || document.getElementById('tbody-clientes');
    if (!list) return;

    list.innerHTML = '<tr><td colspan="5">Carregando...</td></tr>';
    const dados = await DB.getClientes();

    if (dados.length === 0) {
      list.innerHTML = '<tr><td colspan="5">Nenhum cliente cadastrado.</td></tr>';
      return;
    }

    list.innerHTML = dados.map(c => `
      <tr>
        <td>${c.nome}</td>
        <td>${c.whatsapp || '—'}</td>
        <td>${Utils.currency(c.valor_mensalidade)}</td>
        <td><span class="badge badge-success">Ativo</span></td>
        <td><button class="btn-icon">✏️</button></td>
      </tr>
    `).join('');
  }
};

window.onload = () => App.init();