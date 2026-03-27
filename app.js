const Utils = {
  formatCurrency(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); },
  formatPhone(p) { return p ? p.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3") : '—'; },
  today() { return new Date().toISOString().split('T')[0]; }
};

const App = {
  async init() {
    const session = SessionManager.verify();
    if (session) this.showApp(session.sub);
    this.bindEvents();
  },

  showApp(user) {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('sidebar-username').innerText = user;
    this.loadView('dashboard');
  },

  bindEvents() {
    // Login
    const btnL = document.getElementById('btn-login');
    if(btnL) btnL.onclick = async () => {
      const u = document.getElementById('login-user').value;
      const p = document.getElementById('login-pass').value;
      if(await DB.login(u,p)) this.showApp(u); else alert("Erro no login");
    };

    // Navegação
    document.querySelectorAll('.nav-item').forEach(item => {
      item.onclick = (e) => {
        const page = e.currentTarget.dataset.page;
        if(page === 'logout') { SessionManager.destroy(); location.reload(); }
        else this.loadView(page);
      };
    });

    // Modais (Abrir/Fechar)
    document.querySelectorAll('[data-modal]').forEach(b => {
      b.onclick = () => {
        const m = document.getElementById(b.dataset.modal);
        const ov = document.getElementById('modal-overlay');
        if(m.classList.contains('hidden')) { m.classList.remove('hidden'); ov.classList.remove('hidden'); }
        else { m.classList.add('hidden'); ov.classList.add('hidden'); }
      };
    });

    // Salvar Cliente
    const btnSC = document.getElementById('btn-save-cliente');
    if(btnSC) btnSC.onclick = async () => {
      const d = {
        nome: document.getElementById('cli-nome').value,
        whatsapp: document.getElementById('cli-whatsapp').value,
        dia_vencimento: parseInt(document.getElementById('cli-vencimento').value) || 10,
        valor_mensalidade: parseFloat(document.getElementById('cli-valor').value) || 0,
        status: 'ativo'
      };
      if(!d.nome) return alert("Nome obrigatório");
      btnSC.innerText = "⏳...";
      if(await DB.salvarCliente(d)) {
        alert("Sucesso!");
        location.reload();
      }
    };
  },

  async loadView(view) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    const target = document.getElementById(`page-${view}`);
    if(target) target.classList.add('active');
    
    const nav = document.querySelector(`.nav-item[data-page="${view}"]`);
    if(nav) nav.classList.add('active');

    if(view === 'dashboard') this.updateDash();
    if(view === 'clientes') this.updateClientes();
  },

  async updateDash() {
    const clis = await DB.getClientes();
    const tras = await DB.getTransacoes();
    const elC = document.getElementById('val-clientes') || document.getElementById('stat-clientes');
    const elF = document.getElementById('val-faturamento') || document.getElementById('stat-receita');
    if(elC) elC.innerText = clis.length;
    if(elF) elF.innerText = Utils.formatCurrency(tras.filter(t=>t.tipo==='entrada').reduce((a,b)=>a+b.valor,0));
  },

  async updateClientes() {
    const list = document.getElementById('tbody-clientes') || document.getElementById('clientes-list');
    const dados = await DB.getClientes();
    if(!list) return;
    list.innerHTML = dados.map(c => `<tr><td>${c.nome}</td><td>${Utils.formatPhone(c.whatsapp)}</td><td>${Utils.formatCurrency(c.valor_mensalidade)}</td><td><span class="badge badge-success">${c.status}</span></td></tr>`).join('');
  }
};
window.onload = () => App.init();