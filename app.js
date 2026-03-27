/**
 * ═══════════════════════════════════════════════════════════════
 * KAPPO BUSINESS — app.js
 * Aplicação Principal — CRM/ERP para Rastreamento Veicular
 * Vanilla JS · Modular · LGPD Compliant
 * ═══════════════════════════════════════════════════════════════
 */

/* ──────────────────────────────────────────────
   UTILS
   ────────────────────────────────────────────── */
const Utils = {
  formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  },

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

  escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  today() {
    return new Date().toISOString().split('T')[0];
  },

  diasAtraso(dateStr) {
    if (!dateStr) return 0;
    const venc = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);
    const diff = Math.floor((today - venc) / 86400000);
    return diff > 0 ? diff : 0;
  },

  getMonthName(m) {
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return nomes[(m - 1)] || m;
  },

  getMonthOptions() {
    const opts = [];
    for (let i = 1; i <= 12; i++) {
      opts.push(`<option value="${i}">${Utils.getMonthName(i)}</option>`);
    }
    return opts.join('');
  },

  statusBadge(status) {
    const map = {
      ativo:    { cls: 'badge-green',  label: '● ATIVO' },
      suspenso: { cls: 'badge-gray',   label: '○ SUSPENSO' },
      pago:     { cls: 'badge-green',  label: '✔ PAGO' },
      a_vencer: { cls: 'badge-cyan',   label: '◷ A VENCER' },
      atrasado: { cls: 'badge-red',    label: '✕ ATRASADO' },
      entrada:  { cls: 'badge-green',  label: '▲ ENTRADA' },
      saida:    { cls: 'badge-red',    label: '▼ SAÍDA' },
    };
    const s = map[status] || { cls: 'badge-gray', label: status };
    return `<span class="badge ${s.cls}">${s.label}</span>`;
  },

  catLabel(cat) {
    const map = {
      mensalidade: 'Mensalidade',
      chips_m2m: 'Chips M2M',
      servidor: 'Servidor AWS',
      marketing: 'Marketing',
      outros: 'Outros'
    };
    return map[cat] || cat;
  }
};

/* ──────────────────────────────────────────────
   TOAST SYSTEM
   ────────────────────────────────────────────── */
const Toast = {
  show(msg, type = 'info', duration = 4000) {
    const icons = { success: '✔', error: '✕', warning: '⚠', info: 'ℹ' };
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${Utils.escapeHtml(msg)}</span>`;
    container.appendChild(el);

    setTimeout(() => {
      el.classList.add('removing');
      el.addEventListener('animationend', () => el.remove());
    }, duration);
  },

  success: (msg) => Toast.show(msg, 'success'),
  error:   (msg) => Toast.show(msg, 'error', 5000),
  warning: (msg) => Toast.show(msg, 'warning'),
  info:    (msg) => Toast.show(msg, 'info')
};

/* ──────────────────────────────────────────────
   MODAL SYSTEM
   ────────────────────────────────────────────── */
const Modal = {
  _deleteCallback: null,

  open(id) {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('active');
    document.getElementById(id)?.classList.remove('hidden');
  },

  close(id) {
    document.getElementById(id)?.classList.add('hidden');
    const overlay = document.getElementById('modal-overlay');
    const openModals = overlay.querySelectorAll('.modal:not(.hidden)');
    if (openModals.length === 0) {
      overlay.classList.add('hidden');
      overlay.classList.remove('active');
    }
  },

  closeAll() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('active');
  },

  confirm(msg, callback) {
    document.getElementById('confirm-msg').textContent = msg;
    this._deleteCallback = callback;
    this.open('modal-confirm');
  }
};

/* ──────────────────────────────────────────────
   APP — CONTROLADOR PRINCIPAL
   ────────────────────────────────────────────── */
const App = {
  currentPage: 'dashboard',
  clientes: [],

  async init() {
    // Inicializa DB
    DB.init();

    // Seed de dados demo se vazio
    await DB.seedDemoData();

    // Verifica sessão
    const session = SessionManager.verify();
    if (session) {
      this.showApp(session.sub);
    } else {
      this.showLogin();
    }

    // Bind eventos globais
    this.bindGlobalEvents();

    // Relógio
    this.startClock();
  },

  /* ──── AUTH ──── */
  showLogin() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('app').classList.remove('active');
  },

  showApp(username) {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('sidebar-username').textContent = username || 'Admin Master';
    this.navigate('dashboard');
  },

  async handleLogin() {
    const user = document.getElementById('login-user').value.trim();
    const pass = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-error');
    const errMsg = document.getElementById('login-error-msg');
    const btn = document.getElementById('btn-login');

    if (!user || !pass) {
      errMsg.textContent = 'Preencha todos os campos.';
      errEl.classList.remove('hidden');
      return;
    }

    // Feedback de loading
    btn.querySelector('.btn-text').textContent = '⏳ AUTENTICANDO...';
    btn.disabled = true;

    try {
      const ok = await DB.login(user, pass);
      if (ok) {
        SessionManager.create(user);
        errEl.classList.add('hidden');
        this.showApp(user);
        Toast.success(`Bem-vindo, ${user}!`);
      } else {
        errMsg.textContent = 'Usuário ou senha incorretos.';
        errEl.classList.remove('hidden');
      }
    } catch (e) {
      errMsg.textContent = 'Erro ao verificar credenciais.';
      errEl.classList.remove('hidden');
    } finally {
      btn.querySelector('.btn-text').textContent = '▶ INICIAR SESSÃO SEGURA';
      btn.disabled = false;
    }
  },

  logout() {
    SessionManager.destroy();
    this.showLogin();
    Toast.info('Sessão encerrada.');
  },

  /* ──── NAVEGAÇÃO ──── */
  navigate(page) {
    this.currentPage = page;

    // Atualiza nav items
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    // Atualiza páginas
    document.querySelectorAll('.page').forEach(el => {
      el.classList.toggle('active', el.id === `page-${page}`);
    });

    // Atualiza título
    const titles = {
      dashboard: 'DASHBOARD',
      clientes: 'CLIENTES',
      mensalidades: 'MENSALIDADES',
      financeiro: 'FINANCEIRO',
      reserva: 'FUNDO DE RESERVA',
      configuracoes: 'CONFIGURAÇÕES'
    };
    document.getElementById('page-title').textContent = titles[page] || page.toUpperCase();

    // Fecha sidebar mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('open');

    // Carrega dados da página
    this.loadPage(page);
  },

  async loadPage(page) {
    switch (page) {
      case 'dashboard':    await Dashboard.load(); break;
      case 'clientes':     await ClientesPage.load(); break;
      case 'mensalidades': await MensalidadesPage.load(); break;
      case 'financeiro':   await FinanceiroPage.load(); break;
      case 'reserva':      await ReservaPage.load(); break;
      case 'configuracoes': ConfigPage.load(); break;
    }
  },

  /* ──── GLOBAL EVENTS ──── */
  bindGlobalEvents() {
    // Login
    document.getElementById('btn-login').addEventListener('click', () => this.handleLogin());
    document.getElementById('login-pass').addEventListener('keydown', e => {
      if (e.key === 'Enter') this.handleLogin();
    });
    document.getElementById('login-user').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('login-pass').focus();
    });

    // Toggle senha
    document.getElementById('toggle-pass').addEventListener('click', () => {
      const inp = document.getElementById('login-pass');
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => this.logout());

    // Sidebar mobile
    document.getElementById('topbar-menu').addEventListener('click', () => {
      document.getElementById('sidebar').classList.add('open');
      document.getElementById('sidebar-overlay').classList.add('open');
    });
    document.getElementById('sidebar-close').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('open');
    });
    document.getElementById('sidebar-overlay').addEventListener('click', () => {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('open');
    });

    // Nav items
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.page));
    });

    // Refresh
    document.getElementById('btn-refresh').addEventListener('click', () => this.loadPage(this.currentPage));

    // Modal close buttons
    document.querySelectorAll('.modal-close, [data-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.dataset.modal || btn.closest('.modal')?.id;
        if (modalId) Modal.close(modalId);
      });
    });

    // Modal overlay click
    document.getElementById('modal-overlay').addEventListener('click', e => {
      if (e.target === document.getElementById('modal-overlay')) Modal.closeAll();
    });

    // Confirm delete
    document.getElementById('btn-confirm-delete').addEventListener('click', () => {
      if (Modal._deleteCallback) {
        Modal._deleteCallback();
        Modal._deleteCallback = null;
      }
      Modal.close('modal-confirm');
    });

    // Clientes botões
    document.getElementById('btn-novo-cliente').addEventListener('click', () => ClientesPage.openModal());
    document.getElementById('btn-salvar-cliente').addEventListener('click', () => ClientesPage.save());
    document.getElementById('search-clientes').addEventListener('input', Utils.debounce(() => ClientesPage.load(), 300));
    document.getElementById('filter-status-cliente').addEventListener('change', () => ClientesPage.load());

    // Mensalidades
    document.getElementById('btn-nova-mensalidade').addEventListener('click', () => MensalidadesPage.openModal());
    document.getElementById('btn-salvar-mensalidade').addEventListener('click', () => MensalidadesPage.save());
    document.getElementById('search-mensalidades').addEventListener('input', Utils.debounce(() => MensalidadesPage.load(), 300));
    document.getElementById('filter-status-mens').addEventListener('change', () => MensalidadesPage.load());
    document.getElementById('filter-mes-mens').addEventListener('change', () => MensalidadesPage.load());

    // Financeiro
    document.getElementById('btn-nova-transacao').addEventListener('click', () => FinanceiroPage.openModal());
    document.getElementById('btn-salvar-transacao').addEventListener('click', () => FinanceiroPage.save());
    document.getElementById('filter-tipo-tx').addEventListener('change', () => FinanceiroPage.load());
    document.getElementById('filter-cat-tx').addEventListener('change', () => FinanceiroPage.load());
    document.getElementById('filter-mes-tx').addEventListener('change', () => FinanceiroPage.load());

    // Reserva
    document.getElementById('btn-salvar-reserva').addEventListener('click', () => ReservaPage.saveConfig());
    document.getElementById('btn-depositar-reserva').addEventListener('click', () => ReservaPage.depositar());
    document.getElementById('reserva-percent').addEventListener('input', () => ReservaPage.updatePreview());

    // Config
    document.getElementById('btn-salvar-supabase').addEventListener('click', () => ConfigPage.saveSupabase());
    document.getElementById('btn-salvar-creds').addEventListener('click', () => ConfigPage.saveCreds());
    document.getElementById('btn-salvar-traccar').addEventListener('click', () => ConfigPage.saveTraccar());
    document.getElementById('btn-clear-storage').addEventListener('click', () => ConfigPage.clearStorage());
    document.getElementById('btn-export-data').addEventListener('click', () => ConfigPage.exportData());

    // Populate mes selects
    this.populateMesSelects();
  },

  populateMesSelects() {
    const mesOpts = Utils.getMonthOptions();
    ['filter-mes-mens', 'filter-mes-tx', 'mens-mes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        if (id === 'filter-mes-mens' || id === 'filter-mes-tx') {
          el.innerHTML = '<option value="">Todos os Meses</option>' + mesOpts;
        } else {
          el.innerHTML = mesOpts;
          el.value = new Date().getMonth() + 1;
        }
      }
    });
    const anoEl = document.getElementById('mens-ano');
    if (anoEl) anoEl.value = new Date().getFullYear();
  },

  startClock() {
    const update = () => {
      const el = document.getElementById('current-time');
      if (el) {
        el.textContent = new Date().toLocaleTimeString('pt-BR');
      }
    };
    update();
    setInterval(update, 1000);
  }
};

// Debounce util (adiciona no Utils)
Utils.debounce = (fn, delay) => {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
};

/* ══════════════════════════════════════════════════════════════
   DASHBOARD
   ═══════════════════════════════════════════════════════════ */
const Dashboard = {
  async load() {
    const metrics = await DB.getMetricas();
    const clientes = await DB.getClientes();

    // Atualiza métricas
    document.getElementById('val-faturamento').textContent = Utils.formatCurrency(metrics.faturamento);
    document.getElementById('val-despesas').textContent = Utils.formatCurrency(metrics.despesas);
    document.getElementById('val-lucro').textContent = Utils.formatCurrency(metrics.lucro);
    document.getElementById('val-inadimplentes').textContent = metrics.inadimplentes;
    document.getElementById('val-clientes').textContent = metrics.clientesAtivos;
    document.getElementById('sub-clientes').textContent = `${metrics.totalClientes} total na base`;
    document.getElementById('val-reserva').textContent = Utils.formatCurrency(metrics.reservaSaldo);

    // Colorização do lucro
    const lucroEl = document.getElementById('val-lucro');
    if (metrics.lucro < 0) {
      lucroEl.style.color = 'var(--red)';
    } else {
      lucroEl.style.color = '';
    }

    // Tabela inadimplentes
    const tbody = document.getElementById('tbody-inadimplentes');
    if (!metrics.inadimplentesList?.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">✔ Nenhum cliente em atraso. Ótimo!</td></tr>';
    } else {
      tbody.innerHTML = metrics.inadimplentesList.map(m => {
        const cl = clientes.find(c => c.id === m.cliente_id);
        const dias = Utils.diasAtraso(m.data_vencimento);
        return `
          <tr>
            <td><strong>${Utils.escapeHtml(cl?.nome || 'N/A')}</strong></td>
            <td>
              <a class="wa-link" href="https://wa.me/55${(cl?.whatsapp||'').replace(/\D/g,'')}" target="_blank">
                📱 ${Utils.formatPhone(cl?.whatsapp)}
              </a>
            </td>
            <td class="tx-entrada">${Utils.formatCurrency(m.valor)}</td>
            <td>${Utils.formatDate(m.data_vencimento)}</td>
            <td><span style="color:var(--red);font-weight:700">${dias} dia(s)</span></td>
            <td>
              <button class="btn-icon success" onclick="MensalidadesPage.marcarPago('${m.id}')">✔ Pago</button>
            </td>
          </tr>`;
      }).join('');
    }

    // Tabela últimas transações
    const tbodyTx = document.getElementById('tbody-transacoes-dash');
    if (!metrics.ultimasTransacoes?.length) {
      tbodyTx.innerHTML = '<tr><td colspan="5" class="table-empty">Nenhuma transação registrada.</td></tr>';
    } else {
      tbodyTx.innerHTML = metrics.ultimasTransacoes.map(tx => `
        <tr>
          <td>${Utils.formatDate(tx.data)}</td>
          <td>${Utils.escapeHtml(tx.descricao || '—')}</td>
          <td>${Utils.catLabel(tx.categoria)}</td>
          <td>${Utils.statusBadge(tx.tipo)}</td>
          <td class="${tx.tipo === 'entrada' ? 'tx-entrada' : 'tx-saida'}">
            ${tx.tipo === 'saida' ? '- ' : '+ '}${Utils.formatCurrency(tx.valor)}
          </td>
        </tr>`).join('');
    }
  }
};

/* ══════════════════════════════════════════════════════════════
   CLIENTES PAGE
   ═══════════════════════════════════════════════════════════ */
const ClientesPage = {
  async load() {
    const search = document.getElementById('search-clientes').value;
    const status = document.getElementById('filter-status-cliente').value;

    const clientes = await DB.getClientes({ search, status });
    const tbody = document.getElementById('tbody-clientes');

    if (!clientes.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="table-empty">Nenhum cliente encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = clientes.map(c => `
      <tr>
        <td><strong>${Utils.escapeHtml(c.nome)}</strong></td>
        <td>
          <a class="wa-link" href="https://wa.me/55${(c.whatsapp||'').replace(/\D/g,'')}" target="_blank">
            ${Utils.formatPhone(c.whatsapp)}
          </a>
        </td>
        <td>${Utils.escapeHtml(c.email || '—')}</td>
        <td style="text-align:center">${c.veiculos || 1}</td>
        <td style="text-align:center">Todo dia ${c.dia_vencimento || '—'}</td>
        <td class="tx-entrada">${Utils.formatCurrency(c.valor_mensal)}</td>
        <td>${Utils.statusBadge(c.status)}</td>
        <td>
          <button class="btn-icon" onclick="ClientesPage.openModal('${c.id}')">✏ Editar</button>
          <button class="btn-icon delete" onclick="ClientesPage.delete('${c.id}', '${Utils.escapeHtml(c.nome)}')">🗑</button>
        </td>
      </tr>`).join('');

    // Popula selects de clientes nos modais
    this.populateClienteSelects(clientes);
  },

  populateClienteSelects(clientes) {
    const opts = '<option value="">Selecione um cliente...</option>' +
      clientes.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.nome)}</option>`).join('');
    ['mens-cliente-id', 'tx-cliente'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const val = el.value;
        el.innerHTML = opts.replace(`value="${c.id}"`, `value="${c.id}"`);
        el.value = val;
      }
    });
  },

  openModal(id = null) {
    const title = document.getElementById('modal-cliente-title');
    title.textContent = id ? 'Editar Cliente' : 'Novo Cliente';

    // Limpa form
    ['cliente-id','cliente-nome','cliente-whatsapp','cliente-email','cliente-traccar-id','cliente-obs'].forEach(k => {
      document.getElementById(k).value = '';
    });
    document.getElementById('cliente-veiculos').value = 1;
    document.getElementById('cliente-vencimento').value = '';
    document.getElementById('cliente-valor').value = '';
    document.getElementById('cliente-status').value = 'ativo';

    if (id) {
      DB.getClientes().then(list => {
        const c = list.find(x => x.id === id);
        if (!c) return;
        document.getElementById('cliente-id').value = c.id;
        document.getElementById('cliente-nome').value = c.nome || '';
        document.getElementById('cliente-whatsapp').value = c.whatsapp || '';
        document.getElementById('cliente-email').value = c.email || '';
        document.getElementById('cliente-traccar-id').value = c.traccar_id || '';
        document.getElementById('cliente-veiculos').value = c.veiculos || 1;
        document.getElementById('cliente-vencimento').value = c.dia_vencimento || '';
        document.getElementById('cliente-valor').value = c.valor_mensal || '';
        document.getElementById('cliente-status').value = c.status || 'ativo';
        document.getElementById('cliente-obs').value = c.obs || '';
      });
    }

    Modal.open('modal-cliente');
  },

  async save() {
    const nome = document.getElementById('cliente-nome').value.trim();
    const whatsapp = document.getElementById('cliente-whatsapp').value.trim();

    if (!nome || !whatsapp) {
      Toast.error('Nome e WhatsApp são obrigatórios.');
      return;
    }

    const data = {
      id: document.getElementById('cliente-id').value || undefined,
      nome,
      whatsapp,
      email:         document.getElementById('cliente-email').value.trim(),
      traccar_id:    document.getElementById('cliente-traccar-id').value.trim(),
      veiculos:      parseInt(document.getElementById('cliente-veiculos').value) || 1,
      dia_vencimento:parseInt(document.getElementById('cliente-vencimento').value) || null,
      valor_mensal:  parseFloat(document.getElementById('cliente-valor').value) || 0,
      status:        document.getElementById('cliente-status').value,
      obs:           document.getElementById('cliente-obs').value.trim()
    };

    try {
      await DB.saveCliente(data);
      Modal.close('modal-cliente');
      Toast.success(data.id ? 'Cliente atualizado!' : 'Cliente cadastrado com sucesso!');
      await this.load();
    } catch (e) {
      Toast.error('Erro ao salvar cliente: ' + e.message);
    }
  },

  delete(id, nome) {
    Modal.confirm(
      `Deseja excluir o cliente "${nome}"? Todas as mensalidades vinculadas também serão removidas.`,
      async () => {
        await DB.deleteCliente(id);
        Toast.success('Cliente removido.');
        await this.load();
      }
    );
  }
};

/* ══════════════════════════════════════════════════════════════
   MENSALIDADES PAGE
   ═══════════════════════════════════════════════════════════ */
const MensalidadesPage = {
  async load() {
    const search = document.getElementById('search-mensalidades').value;
    const status = document.getElementById('filter-status-mens').value;
    const mes = document.getElementById('filter-mes-mens').value;
    const ano = new Date().getFullYear();

    const filters = { search, status };
    if (mes) filters.mes_ano = `${mes}_${ano}`;

    const list = await DB.getMensalidades(filters);
    const clientes = await DB.getClientes();
    const tbody = document.getElementById('tbody-mensalidades');

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">Nenhuma mensalidade encontrada.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(m => {
      const cl = clientes.find(c => c.id === m.cliente_id);
      return `
        <tr>
          <td><strong>${Utils.escapeHtml(cl?.nome || 'N/A')}</strong></td>
          <td>${Utils.getMonthName(m.mes)}/${m.ano}</td>
          <td>${Utils.formatDate(m.data_vencimento)}</td>
          <td class="tx-entrada">${Utils.formatCurrency(m.valor)}</td>
          <td>${Utils.statusBadge(m.status)}</td>
          <td>${Utils.formatDate(m.pago_em)}</td>
          <td>
            ${m.status !== 'pago' ? `<button class="btn-icon success" onclick="MensalidadesPage.marcarPago('${m.id}')">✔ Pago</button>` : ''}
            <button class="btn-icon" onclick="MensalidadesPage.openModal('${m.id}')">✏</button>
            <button class="btn-icon delete" onclick="MensalidadesPage.delete('${m.id}')">🗑</button>
          </td>
        </tr>`;
    }).join('');
  },

  async openModal(id = null) {
    const clientes = await DB.getClientes();
    const opts = '<option value="">Selecione...</option>' +
      clientes.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.nome)}</option>`).join('');

    document.getElementById('mens-cliente-id').innerHTML = opts;
    document.getElementById('mens-vencimento').value = Utils.today();
    document.getElementById('mens-pago-em').value = Utils.today();
    document.getElementById('mens-obs').value = '';
    document.getElementById('mens-id').value = '';
    document.getElementById('mens-mes').value = new Date().getMonth() + 1;
    document.getElementById('mens-ano').value = new Date().getFullYear();

    if (id) {
      const list = await DB.getMensalidades();
      const m = list.find(x => x.id === id);
      if (m) {
        document.getElementById('mens-id').value = m.id;
        document.getElementById('mens-cliente-id').value = m.cliente_id;
        document.getElementById('mens-mes').value = m.mes;
        document.getElementById('mens-ano').value = m.ano;
        document.getElementById('mens-valor').value = m.valor;
        document.getElementById('mens-vencimento').value = m.data_vencimento;
        document.getElementById('mens-status').value = m.status;
        document.getElementById('mens-pago-em').value = m.pago_em || '';
        document.getElementById('mens-obs').value = m.obs || '';
      }
    } else {
      document.getElementById('mens-valor').value = '';
    }

    Modal.open('modal-mensalidade');
  },

  async save() {
    const clienteId = document.getElementById('mens-cliente-id').value;
    const valor = parseFloat(document.getElementById('mens-valor').value);
    const vencimento = document.getElementById('mens-vencimento').value;

    if (!clienteId || !valor || !vencimento) {
      Toast.error('Cliente, valor e vencimento são obrigatórios.');
      return;
    }

    const data = {
      id: document.getElementById('mens-id').value || undefined,
      cliente_id: clienteId,
      mes: parseInt(document.getElementById('mens-mes').value),
      ano: parseInt(document.getElementById('mens-ano').value),
      valor,
      data_vencimento: vencimento,
      status: document.getElementById('mens-status').value,
      pago_em: document.getElementById('mens-pago-em').value || null,
      obs: document.getElementById('mens-obs').value.trim()
    };

    try {
      await DB.saveMensalidade(data);
      Modal.close('modal-mensalidade');
      Toast.success('Mensalidade salva!');
      await this.load();
      if (App.currentPage === 'dashboard') await Dashboard.load();
    } catch(e) {
      Toast.error('Erro: ' + e.message);
    }
  },

  async marcarPago(id) {
    const list = await DB.getMensalidades();
    const m = list.find(x => x.id === id);
    if (!m) return;
    m.status = 'pago';
    m.pago_em = Utils.today();
    await DB.saveMensalidade(m);
    Toast.success('Mensalidade marcada como paga!');
    await this.load();
    if (App.currentPage === 'dashboard') await Dashboard.load();
  },

  delete(id) {
    Modal.confirm('Excluir esta mensalidade?', async () => {
      await DB.deleteMensalidade(id);
      Toast.success('Mensalidade removida.');
      await this.load();
    });
  }
};

/* ══════════════════════════════════════════════════════════════
   FINANCEIRO PAGE
   ═══════════════════════════════════════════════════════════ */
const FinanceiroPage = {
  async load() {
    const tipo = document.getElementById('filter-tipo-tx').value;
    const categoria = document.getElementById('filter-cat-tx').value;
    const mes = document.getElementById('filter-mes-tx').value;
    const ano = new Date().getFullYear();

    const filters = { tipo, categoria };
    if (mes) filters.mes_ano = `${mes}_${ano}`;

    const list = await DB.getTransacoes(filters);
    const clientes = await DB.getClientes();
    const tbody = document.getElementById('tbody-transacoes');

    // Calcula totais
    const entradas = list.filter(t => t.tipo === 'entrada').reduce((a,t) => a + parseFloat(t.valor||0), 0);
    const saidas   = list.filter(t => t.tipo === 'saida').reduce((a,t) => a + parseFloat(t.valor||0), 0);

    document.getElementById('fin-entradas').textContent = Utils.formatCurrency(entradas);
    document.getElementById('fin-saidas').textContent   = Utils.formatCurrency(saidas);
    const saldo = entradas - saidas;
    const saldoEl = document.getElementById('fin-saldo');
    saldoEl.textContent = Utils.formatCurrency(saldo);
    saldoEl.style.color = saldo < 0 ? 'var(--red)' : '';

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Nenhuma transação encontrada.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(tx => {
      const cl = clientes.find(c => c.id === tx.cliente_id);
      return `
        <tr>
          <td>${Utils.formatDate(tx.data)}</td>
          <td>
            <div>${Utils.escapeHtml(tx.descricao || '—')}</div>
            ${cl ? `<div style="font-size:0.75rem;color:var(--text-muted)">${Utils.escapeHtml(cl.nome)}</div>` : ''}
          </td>
          <td>${Utils.catLabel(tx.categoria)}</td>
          <td>${Utils.statusBadge(tx.tipo)}</td>
          <td class="${tx.tipo === 'entrada' ? 'tx-entrada' : 'tx-saida'}">
            ${tx.tipo === 'saida' ? '- ' : '+ '}${Utils.formatCurrency(tx.valor)}
          </td>
          <td>
            <button class="btn-icon" onclick="FinanceiroPage.openModal('${tx.id}')">✏</button>
            <button class="btn-icon delete" onclick="FinanceiroPage.delete('${tx.id}')">🗑</button>
          </td>
        </tr>`;
    }).join('');
  },

  async openModal(id = null) {
    const clientes = await DB.getClientes();
    const opts = '<option value="">— Nenhum —</option>' +
      clientes.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.nome)}</option>`).join('');
    document.getElementById('tx-cliente').innerHTML = opts;

    document.getElementById('tx-id').value = '';
    document.getElementById('tx-tipo').value = 'entrada';
    document.getElementById('tx-categoria').value = 'mensalidade';
    document.getElementById('tx-descricao').value = '';
    document.getElementById('tx-data').value = Utils.today();
    document.getElementById('tx-valor').value = '';
    document.getElementById('tx-cliente').value = '';

    if (id) {
      const list = await DB.getTransacoes();
      const tx = list.find(x => x.id === id);
      if (tx) {
        document.getElementById('tx-id').value = tx.id;
        document.getElementById('tx-tipo').value = tx.tipo;
        document.getElementById('tx-categoria').value = tx.categoria;
        document.getElementById('tx-descricao').value = tx.descricao;
        document.getElementById('tx-data').value = tx.data;
        document.getElementById('tx-valor').value = tx.valor;
        document.getElementById('tx-cliente').value = tx.cliente_id || '';
      }
    }

    Modal.open('modal-transacao');
  },

  async save() {
    const descricao = document.getElementById('tx-descricao').value.trim();
    const valor = parseFloat(document.getElementById('tx-valor').value);
    const data = document.getElementById('tx-data').value;

    if (!descricao || !valor || !data) {
      Toast.error('Descrição, valor e data são obrigatórios.');
      return;
    }

    const tx = {
      id: document.getElementById('tx-id').value || undefined,
      tipo:       document.getElementById('tx-tipo').value,
      categoria:  document.getElementById('tx-categoria').value,
      descricao,
      data,
      valor,
      cliente_id: document.getElementById('tx-cliente').value || null
    };

    try {
      await DB.saveTransacao(tx);
      Modal.close('modal-transacao');
      Toast.success('Transação salva!');
      await this.load();
    } catch(e) {
      Toast.error('Erro: ' + e.message);
    }
  },

  delete(id) {
    Modal.confirm('Excluir esta transação?', async () => {
      await DB.deleteTransacao(id);
      Toast.success('Transação removida.');
      await this.load();
    });
  }
};

/* ══════════════════════════════════════════════════════════════
   RESERVA PAGE
   ═══════════════════════════════════════════════════════════ */
const ReservaPage = {
  async load() {
    const reserva = await DB.getReserva();
    const metrics = await DB.getMetricas();

    document.getElementById('reserva-saldo-valor').textContent = Utils.formatCurrency(reserva.saldo || 0);
    document.getElementById('reserva-percent').value = reserva.percentual || 10;

    // Calcula meses de operação cobertos
    const mediaDespesas = metrics.despesas || 1;
    const meses = mediaDespesas > 0 ? ((reserva.saldo || 0) / mediaDespesas).toFixed(1) : '∞';
    document.getElementById('reserva-meses').textContent = meses;

    // Histórico de depósitos
    const tbody = document.getElementById('tbody-reserva');
    const deps = (reserva.depositos || []).slice().reverse();

    if (!deps.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="table-empty">Nenhum depósito realizado ainda.</td></tr>';
    } else {
      tbody.innerHTML = deps.map(d => `
        <tr>
          <td>${Utils.formatDate(d.data)}</td>
          <td>${d.percentual}% do lucro líquido</td>
          <td class="tx-entrada">${Utils.formatCurrency(d.valor)}</td>
          <td style="color:var(--green)">${Utils.formatCurrency(d.saldo_acumulado)}</td>
        </tr>`).join('');
    }

    this.updatePreview();
  },

  async updatePreview() {
    const pct = parseFloat(document.getElementById('reserva-percent').value) || 0;
    const metrics = await DB.getMetricas();
    const lucro = metrics.lucro || 0;
    const val = (lucro * pct) / 100;

    const prev = document.getElementById('reserva-preview');
    const prevVal = document.getElementById('reserva-preview-val');

    if (pct > 0 && lucro > 0) {
      prev.style.display = 'block';
      prevVal.textContent = Utils.formatCurrency(val);
    } else {
      prev.style.display = 'none';
    }
  },

  async saveConfig() {
    const pct = parseFloat(document.getElementById('reserva-percent').value);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      Toast.error('Percentual inválido (0–100).');
      return;
    }
    const reserva = await DB.getReserva();
    reserva.percentual = pct;
    await DB.saveReserva(reserva);
    Toast.success('Configuração de reserva salva!');
  },

  async depositar() {
    const pct = parseFloat(document.getElementById('reserva-percent').value);
    if (!pct || pct <= 0) {
      Toast.error('Defina um percentual válido primeiro.');
      return;
    }
    const metrics = await DB.getMetricas();
    if (metrics.lucro <= 0) {
      Toast.warning('Lucro líquido insuficiente para depósito neste mês.');
      return;
    }

    const result = await DB.depositarReserva(pct, metrics.lucro);
    if (result.error) {
      Toast.error(result.error);
    } else {
      Toast.success(`Depositado ${Utils.formatCurrency(result.valor)} no fundo de reserva!`);
      await this.load();
    }
  }
};

/* ══════════════════════════════════════════════════════════════
   CONFIG PAGE
   ═══════════════════════════════════════════════════════════ */
const ConfigPage = {
  load() {
    const cfg = DB.getConfig();
    if (cfg.supabaseUrl) document.getElementById('cfg-sb-url').value = cfg.supabaseUrl;
    if (cfg.supabaseKey) document.getElementById('cfg-sb-key').value = cfg.supabaseKey;
    if (cfg.traccarUrl)  document.getElementById('cfg-traccar-url').value = cfg.traccarUrl;
    if (cfg.traccarToken) document.getElementById('cfg-traccar-token').value = cfg.traccarToken;
  },

  async saveSupabase() {
    const url = document.getElementById('cfg-sb-url').value.trim();
    const key = document.getElementById('cfg-sb-key').value.trim();
    const statusEl = document.getElementById('supabase-status');

    if (!url || !key) {
      Toast.error('URL e chave são obrigatórias.');
      return;
    }

    // Testa conexão
    SupabaseClient.init(url, key);
    statusEl.className = 'cfg-status';
    statusEl.textContent = '⏳ Testando conexão...';
    statusEl.classList.remove('hidden');

    try {
      await SupabaseClient.select('clientes', 'select=id&limit=1');
      DB.saveConfig({ supabaseUrl: url, supabaseKey: key });
      statusEl.classList.add('success');
      statusEl.textContent = '✔ Conexão estabelecida com sucesso!';
      Toast.success('Supabase configurado!');
    } catch (e) {
      statusEl.classList.add('error');
      statusEl.textContent = `✕ Falha na conexão: ${e.message}`;
    }
  },

  async saveCreds() {
    const user = document.getElementById('cfg-new-user').value.trim();
    const pass = document.getElementById('cfg-new-pass').value;
    const conf = document.getElementById('cfg-conf-pass').value;
    const statusEl = document.getElementById('creds-status');

    if (!user || !pass) {
      Toast.error('Usuário e senha são obrigatórios.');
      return;
    }
    if (pass !== conf) {
      Toast.error('As senhas não coincidem.');
      return;
    }
    if (pass.length < 8) {
      Toast.error('A senha deve ter ao menos 8 caracteres.');
      return;
    }

    await DB.updateCredentials(user, pass);
    statusEl.className = 'cfg-status success';
    statusEl.textContent = '✔ Credenciais atualizadas! Faça login novamente.';
    statusEl.classList.remove('hidden');
    Toast.success('Credenciais salvas! Você será redirecionado ao login.');
    setTimeout(() => App.logout(), 3000);
  },

  saveTraccar() {
    const url = document.getElementById('cfg-traccar-url').value.trim();
    const token = document.getElementById('cfg-traccar-token').value.trim();
    DB.saveConfig({ traccarUrl: url, traccarToken: token });
    Toast.success('Configuração do Traccar salva!');
  },

  clearStorage() {
    Modal.confirm(
      'Isso irá remover TODOS os dados locais (clientes, mensalidades, transações) e recarregar a página com dados demo. Continuar?',
      () => {
        Object.values(LocalStore.KEYS).forEach(k => localStorage.removeItem(k));
        SessionManager.destroy();
        Toast.info('Dados limpos. Recarregando...');
        setTimeout(() => location.reload(), 1500);
      }
    );
  },

  exportData() {
    const data = {
      exportedAt: new Date().toISOString(),
      clientes: LocalStore.getClientes(),
      mensalidades: LocalStore.getMensalidades(),
      transacoes: LocalStore.getTransacoes(),
      reserva: LocalStore.getReserva()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kappo-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('Dados exportados com sucesso!');
  }
};

/* ══════════════════════════════════════════════════════════════
   BOOTSTRAP
   ═══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => App.init());
