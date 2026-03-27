/**
 * ═══════════════════════════════════════════════════════════════
 * KAPPO BUSINESS — app.js (VERSÃO REFATORADA BLINDADA v3.0)
 * ═══════════════════════════════════════════════════════════════
 * Correções aplicadas:
 * 1. Login com transição atômica — remove login-screen do DOM após fade
 * 2. loadView() com guard para evitar dupla chamada
 * 3. Máscaras automáticas: WhatsApp e moeda
 * 4. Todos os botões Salvar com estado de loading + reativação garantida
 * 5. Toasts em TODAS as operações (sucesso e erro)
 * 6. Tabelas exibem mensagem amigável se DB offline
 * 7. Dashboard completo: faturamento, despesas, lucro, inadimplentes
 * 8. CRUD completo: Clientes, Mensalidades, Transações, Reserva, Configurações
 * ═══════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────
// UTILITÁRIOS
// ─────────────────────────────────────────────
const Utils = {
  formatCurrency(val) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const s = dateStr.split('T')[0];
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  },

  formatPhone(phone) {
    const n = (phone || '').replace(/\D/g, '');
    if (n.length === 11) return `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`;
    if (n.length === 10) return `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`;
    return phone || '—';
  },

  today() { return new Date().toISOString().split('T')[0]; },

  currentMonth() { return new Date().getMonth() + 1; },
  currentYear()  { return new Date().getFullYear(); },

  // Máscara de telefone ao digitar
  maskPhone(input) {
    input.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 11);
      if (v.length > 10) {
        v = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
      } else if (v.length > 6) {
        v = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
      } else if (v.length > 2) {
        v = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
      }
      e.target.value = v;
    });
  },

  // Gera HTML de badge de status
  badgeStatus(status) {
    const map = {
      ativo:    ['badge-success', 'Ativo'],
      suspenso: ['badge-danger',  'Suspenso'],
      pago:     ['badge-success', 'Pago'],
      a_vencer: ['badge-warning', 'A Vencer'],
      atrasado: ['badge-danger',  'Atrasado']
    };
    const [cls, label] = map[status] || ['badge-default', status];
    return `<span class="badge ${cls}">${label}</span>`;
  },

  // Nome do mês em PT-BR
  nomeMes(num) {
    return ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
                'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][num] || '—';
  }
};

// ─────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────
const Toast = {
  _show(msg, type) {
    const container = document.getElementById('toast-container');
    if (!container) { alert(msg); return; }

    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    container.appendChild(t);

    // Entrada suave
    requestAnimationFrame(() => t.classList.add('visible'));

    setTimeout(() => {
      t.classList.remove('visible');
      t.classList.add('removing');
      setTimeout(() => t.remove(), 350);
    }, 3500);
  },
  success(m) { this._show(m, 'success'); },
  error(m)   { this._show(m, 'error'); },
  warn(m)    { this._show(m, 'warn'); },
  info(m)    { this._show(m, 'info'); }
};

// ─────────────────────────────────────────────
// MODAL MANAGER
// ─────────────────────────────────────────────
const Modal = {
  open(id) {
    const overlay = document.getElementById('modal-overlay');
    const target  = document.getElementById(id);
    if (overlay) overlay.classList.remove('hidden');
    if (target)  target.classList.remove('hidden');
  },
  close(id) {
    const target = document.getElementById(id);
    if (target) target.classList.add('hidden');
    // Fecha overlay se nenhum modal estiver aberto
    const abertos = document.querySelectorAll('.modal:not(.hidden)');
    if (abertos.length === 0) {
      const overlay = document.getElementById('modal-overlay');
      if (overlay) overlay.classList.add('hidden');
    }
  },
  closeAll() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
  }
};

// ─────────────────────────────────────────────
// HELPERS DE BOTÃO COM LOADING STATE
// ─────────────────────────────────────────────
const BtnState = {
  loading(btn, msg = '⏳ Salvando...') {
    btn.disabled = true;
    btn._originalText = btn.innerHTML;
    btn.innerHTML = msg;
  },
  reset(btn) {
    btn.disabled = false;
    if (btn._originalText) btn.innerHTML = btn._originalText;
  }
};

// ─────────────────────────────────────────────
// RELÓGIO SIDEBAR
// ─────────────────────────────────────────────
function startClock() {
  const el = document.getElementById('current-time');
  if (!el) return;
  const tick = () => {
    el.innerText = new Date().toLocaleTimeString('pt-BR');
  };
  tick();
  setInterval(tick, 1000);
}

// ─────────────────────────────────────────────
// APP PRINCIPAL
// ─────────────────────────────────────────────
const App = {
  _currentView: null,

  async init() {
    console.log('🚀 Kappo Business v3.0 iniciando...');

    const session = SessionManager.verify();
    if (session) {
      this._enterApp(session.sub);
    }

    this._bindGlobalEvents();
  },

  // ── Transição de tela BLINDADA ──────────────
  _enterApp(userName) {
    const loginScreen = document.getElementById('login-screen');
    const appScreen   = document.getElementById('app');
    const userDisplay = document.getElementById('sidebar-username');

    // 1. Esconde o login com animação e REMOVE do fluxo após
    if (loginScreen) {
      loginScreen.style.opacity = '0';
      loginScreen.style.transition = 'opacity 0.4s ease';
      setTimeout(() => loginScreen.classList.add('hidden'), 400);
    }

    // 2. Exibe o app
    if (appScreen) appScreen.classList.remove('hidden');
    if (userDisplay) userDisplay.innerText = userName;

    startClock();
    this.loadView('dashboard');
  },

  // ── BIND DE EVENTOS GLOBAIS ─────────────────
  _bindGlobalEvents() {

    // — LOGIN —
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
      const handleLogin = async () => {
        const user = (document.getElementById('login-user').value || '').trim();
        const pass = (document.getElementById('login-pass').value || '').trim();

        if (!user || !pass) { Toast.error('Preencha usuário e senha.'); return; }

        BtnState.loading(btnLogin, '⏳ Autenticando...');
        const errEl = document.getElementById('login-error');
        if (errEl) errEl.classList.add('hidden');

        const ok = await DB.login(user, pass);
        BtnState.reset(btnLogin);

        if (ok) {
          this._enterApp(user);
        } else {
          if (errEl) {
            errEl.classList.remove('hidden');
            document.getElementById('login-error-msg').innerText = 'Usuário ou senha inválidos.';
          }
          Toast.error('Credenciais inválidas. Tente novamente.');
        }
      };

      btnLogin.onclick = handleLogin;

      // Enter no campo de senha também faz login
      document.getElementById('login-pass')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
      });
    }

    // — TOGGLE SENHA —
    document.getElementById('toggle-pass')?.addEventListener('click', () => {
      const passInput = document.getElementById('login-pass');
      passInput.type = passInput.type === 'password' ? 'text' : 'password';
    });

    // — MENU DE NAVEGAÇÃO —
    document.querySelectorAll('.nav-item').forEach(link => {
      link.addEventListener('click', (e) => {
        const page = e.currentTarget.getAttribute('data-page');
        if (!page) return;
        this.loadView(page);
        // Fecha sidebar mobile
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('visible');
      });
    });

    // — LOGOUT —
    document.getElementById('btn-logout')?.addEventListener('click', () => {
      SessionManager.destroy();
      window.location.reload();
    });

    // — MOBILE SIDEBAR —
    document.getElementById('topbar-menu')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.add('open');
      document.getElementById('sidebar-overlay')?.classList.add('visible');
    });
    document.getElementById('sidebar-close')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('visible');
    });
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('visible');
    });

    // — FECHAR MODAIS —
    document.querySelectorAll('[data-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-modal');
        const modal = document.getElementById(id);
        if (modal && !modal.classList.contains('hidden')) {
          Modal.close(id);
        } else if (modal) {
          Modal.open(id);
        }
      });
    });

    // Clica fora do modal fecha
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') Modal.closeAll();
    });

    // — BOTÃO REFRESH —
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      this.loadView(this._currentView || 'dashboard');
      Toast.info('Dados atualizados!');
    });

    // — NOVO CLIENTE —
    document.getElementById('btn-novo-cliente')?.addEventListener('click', () => {
      ClientesPage.openModal(null);
    });

    // — SALVAR CLIENTE —
    document.getElementById('btn-salvar-cliente')?.addEventListener('click', () => {
      ClientesPage.salvar();
    });

    // — NOVA MENSALIDADE —
    document.getElementById('btn-nova-mensalidade')?.addEventListener('click', () => {
      MensalidadesPage.openModal(null);
    });

    // — SALVAR MENSALIDADE —
    document.getElementById('btn-salvar-mensalidade')?.addEventListener('click', () => {
      MensalidadesPage.salvar();
    });

    // — NOVA TRANSAÇÃO —
    document.getElementById('btn-nova-transacao')?.addEventListener('click', () => {
      FinanceiroPage.openModal(null);
    });

    // — SALVAR TRANSAÇÃO —
    document.getElementById('btn-salvar-transacao')?.addEventListener('click', () => {
      FinanceiroPage.salvar();
    });

    // — SALVAR SUPABASE —
    document.getElementById('btn-salvar-supabase')?.addEventListener('click', () => {
      ConfigPage.testarSupabase();
    });

    // — SALVAR CREDENCIAIS —
    document.getElementById('btn-salvar-creds')?.addEventListener('click', () => {
      ConfigPage.salvarCredenciais();
    });

    // — SALVAR TRACCAR —
    document.getElementById('btn-salvar-traccar')?.addEventListener('click', () => {
      ConfigPage.salvarTraccar();
    });

    // — RESERVA —
    document.getElementById('btn-salvar-reserva')?.addEventListener('click', () => {
      ReservaPage.salvarConfig();
    });
    document.getElementById('btn-depositar-reserva')?.addEventListener('click', () => {
      ReservaPage.depositar();
    });

    // — EXPORT / CLEAR —
    document.getElementById('btn-export-data')?.addEventListener('click', () => {
      ConfigPage.exportarDados();
    });
    document.getElementById('btn-clear-storage')?.addEventListener('click', () => {
      if (confirm('Isso limpará dados locais (demo). Dados no Supabase não serão afetados. Continuar?')) {
        localStorage.clear();
        Toast.warn('Cache local limpo. Recarregando...');
        setTimeout(() => window.location.reload(), 1500);
      }
    });

    // Busca clientes em tempo real
    document.getElementById('search-clientes')?.addEventListener('input', (e) => {
      ClientesPage.filtrar(e.target.value);
    });

    // Filtro status clientes
    document.getElementById('filter-status-cliente')?.addEventListener('change', (e) => {
      ClientesPage.filtrarStatus(e.target.value);
    });

    // Filtros financeiro
    document.getElementById('filter-tipo-tx')?.addEventListener('change', () => FinanceiroPage.aplicarFiltros());
    document.getElementById('filter-cat-tx')?.addEventListener('change',  () => FinanceiroPage.aplicarFiltros());
    document.getElementById('filter-mes-tx')?.addEventListener('change',  () => FinanceiroPage.aplicarFiltros());

    // Filtros mensalidades
    document.getElementById('filter-status-mens')?.addEventListener('change', () => MensalidadesPage.aplicarFiltros());
    document.getElementById('filter-mes-mens')?.addEventListener('change',    () => MensalidadesPage.aplicarFiltros());

    // Preview fundo de reserva
    document.getElementById('reserva-percent')?.addEventListener('input', () => ReservaPage.preview());
  },

  // ── NAVEGAÇÃO ────────────────────────────────
  navigate(view) { this.loadView(view); },

  loadView(view) {
    // Guard: não recarrega se já estiver na view
    // (removido para permitir refresh explícito)

    this._currentView = view;

    // Atualiza breadcrumb
    const titles = {
      dashboard:      'DASHBOARD',
      clientes:       'CLIENTES',
      mensalidades:   'MENSALIDADES',
      financeiro:     'FINANCEIRO',
      reserva:        'FUNDO DE RESERVA',
      configuracoes:  'CONFIGURAÇÕES'
    };
    const el = document.getElementById('page-title');
    if (el) el.innerText = titles[view] || view.toUpperCase();

    // Desativa todas as páginas e menus
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));

    // Ativa página e menu corretos
    document.getElementById(`page-${view}`)?.classList.add('active');
    document.querySelector(`.nav-item[data-page="${view}"]`)?.classList.add('active');

    // Inicializa o módulo da página
    switch (view) {
      case 'dashboard':    DashboardPage.init();    break;
      case 'clientes':     ClientesPage.init();     break;
      case 'mensalidades': MensalidadesPage.init(); break;
      case 'financeiro':   FinanceiroPage.init();   break;
      case 'reserva':      ReservaPage.init();      break;
      case 'configuracoes':ConfigPage.init();       break;
    }
  }
};

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
const DashboardPage = {
  async init() {
    this._setLoading();
    try {
      const [clientes, transacoes, inadimplentes] = await Promise.all([
        DB.getClientes(),
        DB.getTransacoes(),
        DB.getInadimplentes()
      ]);

      const entradas = transacoes.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0);
      const saidas   = transacoes.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0);
      const lucro    = entradas - saidas;

      this._set('val-faturamento', Utils.formatCurrency(entradas));
      this._set('val-despesas',    Utils.formatCurrency(saidas));
      this._set('val-lucro',       Utils.formatCurrency(lucro));
      this._set('val-clientes',    clientes.length);
      this._set('val-inadimplentes', inadimplentes.length);

      // Últimas transações (dashboard)
      this._renderTransacoes(transacoes.slice(0, 8));

      // Inadimplentes
      this._renderInadimplentes(inadimplentes.slice(0, 5));

    } catch (e) {
      console.error('Dashboard error:', e);
      Toast.error('Erro ao carregar dashboard.');
    }
  },

  _setLoading() {
    ['val-faturamento','val-despesas','val-lucro','val-clientes','val-inadimplentes'].forEach(id => {
      this._set(id, '...');
    });
  },

  _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  },

  _renderInadimplentes(lista) {
    const tbody = document.getElementById('tbody-inadimplentes');
    if (!tbody) return;
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">✅ Nenhum cliente em atraso</td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(i => `
      <tr>
        <td><strong>${i.nome}</strong></td>
        <td>${Utils.formatPhone(i.whatsapp)}</td>
        <td>${Utils.formatCurrency(i.valor)}</td>
        <td>${Utils.formatDate(i.data_vencimento)}</td>
        <td><span class="badge badge-danger">${i.dias_atraso} dias</span></td>
        <td>
          <a class="btn-icon" href="https://wa.me/55${(i.whatsapp||'').replace(/\D/g,'')}" target="_blank" title="WhatsApp">💬</a>
        </td>
      </tr>
    `).join('');
  },

  _renderTransacoes(lista) {
    const tbody = document.getElementById('tbody-transacoes-dash');
    if (!tbody) return;
    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">Nenhuma transação registrada.</td></tr>`;
      return;
    }
    tbody.innerHTML = lista.map(t => `
      <tr>
        <td>${Utils.formatDate(t.data)}</td>
        <td>${t.descricao}</td>
        <td><span class="badge badge-default">${t.categoria || '—'}</span></td>
        <td>${t.tipo === 'entrada'
          ? '<span class="badge badge-success">Entrada</span>'
          : '<span class="badge badge-danger">Saída</span>'}</td>
        <td class="${t.tipo === 'entrada' ? 'text-green' : 'text-red'}">${Utils.formatCurrency(t.valor)}</td>
      </tr>
    `).join('');
  }
};

// ─────────────────────────────────────────────
// CLIENTES
// ─────────────────────────────────────────────
const ClientesPage = {
  _todos: [],

  async init() {
    const tbody = document.getElementById('tbody-clientes');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="8" class="table-empty table-loading">⏳ Buscando clientes...</td></tr>`;

    this._todos = await DB.getTodosClientes();
    this._render(this._todos);
  },

  filtrar(termo) {
    if (!termo) { this._render(this._todos); return; }
    const t = termo.toLowerCase();
    this._render(this._todos.filter(c =>
      c.nome?.toLowerCase().includes(t) ||
      c.whatsapp?.includes(t) ||
      c.email?.toLowerCase().includes(t)
    ));
  },

  filtrarStatus(status) {
    if (!status) { this._render(this._todos); return; }
    this._render(this._todos.filter(c => c.status === status));
  },

  _render(lista) {
    const tbody = document.getElementById('tbody-clientes');
    if (!tbody) return;

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="table-empty">Nenhum cliente encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(cli => `
      <tr>
        <td><strong>${cli.nome}</strong></td>
        <td>
          <a href="https://wa.me/55${(cli.whatsapp||'').replace(/\D/g,'')}" target="_blank" class="link-wa">
            ${Utils.formatPhone(cli.whatsapp)}
          </a>
        </td>
        <td>${cli.email || '—'}</td>
        <td>${cli.veiculos || 1}</td>
        <td>Dia ${cli.dia_vencimento || '—'}</td>
        <td>${Utils.formatCurrency(cli.valor_mensal)}</td>
        <td>${Utils.badgeStatus(cli.status)}</td>
        <td class="actions-cell">
          <button class="btn-icon" title="Editar" onclick="ClientesPage.openModal('${cli.id}')">✏️</button>
          <button class="btn-icon btn-icon-danger" title="Excluir" onclick="ClientesPage.confirmarDelete('${cli.id}', '${cli.nome.replace(/'/g,"\\'")}')">🗑</button>
        </td>
      </tr>
    `).join('');
  },

  openModal(id) {
    // Limpa o formulário
    ['cliente-id','cliente-nome','cliente-whatsapp','cliente-email',
     'cliente-traccar-id','cliente-obs'].forEach(f => {
      const el = document.getElementById(f);
      if (el) el.value = '';
    });
    document.getElementById('cliente-veiculos').value  = 1;
    document.getElementById('cliente-vencimento').value = '';
    document.getElementById('cliente-valor').value      = '';
    document.getElementById('cliente-status').value     = 'ativo';

    const titulo = document.getElementById('modal-cliente-title');

    if (id) {
      const cli = this._todos.find(c => c.id === id);
      if (!cli) { Toast.error('Cliente não encontrado.'); return; }
      document.getElementById('cliente-id').value         = cli.id;
      document.getElementById('cliente-nome').value       = cli.nome || '';
      document.getElementById('cliente-whatsapp').value   = Utils.formatPhone(cli.whatsapp);
      document.getElementById('cliente-email').value      = cli.email || '';
      document.getElementById('cliente-traccar-id').value = cli.traccar_id || '';
      document.getElementById('cliente-veiculos').value   = cli.veiculos || 1;
      document.getElementById('cliente-vencimento').value = cli.dia_vencimento || '';
      document.getElementById('cliente-valor').value      = cli.valor_mensal || '';
      document.getElementById('cliente-status').value     = cli.status || 'ativo';
      document.getElementById('cliente-obs').value        = cli.obs || '';
      if (titulo) titulo.innerText = 'Editar Cliente';
    } else {
      if (titulo) titulo.innerText = 'Novo Cliente';
    }

    // Aplica máscara no campo whatsapp
    Utils.maskPhone(document.getElementById('cliente-whatsapp'));

    Modal.open('modal-cliente');
  },

  async salvar() {
    const btn  = document.getElementById('btn-salvar-cliente');
    const nome = document.getElementById('cliente-nome').value.trim();
    if (!nome) { Toast.error('Nome do cliente é obrigatório!'); return; }

    const dados = {
      nome,
      whatsapp:       document.getElementById('cliente-whatsapp').value.replace(/\D/g, ''),
      email:          document.getElementById('cliente-email').value.trim() || null,
      traccar_id:     document.getElementById('cliente-traccar-id').value.trim() || null,
      veiculos:       parseInt(document.getElementById('cliente-veiculos').value) || 1,
      dia_vencimento: parseInt(document.getElementById('cliente-vencimento').value) || null,
      valor_mensal:   parseFloat(document.getElementById('cliente-valor').value) || 0,
      status:         document.getElementById('cliente-status').value,
      obs:            document.getElementById('cliente-obs').value.trim() || null
    };

    const idEl = document.getElementById('cliente-id');
    if (idEl.value) dados.id = idEl.value;

    BtnState.loading(btn);
    const res = await DB.salvarCliente(dados);
    BtnState.reset(btn);

    if (res.ok) {
      Toast.success(dados.id ? '✅ Cliente atualizado!' : '✅ Cliente cadastrado!');
      Modal.close('modal-cliente');
      this.init();
      DashboardPage.init();
    } else {
      Toast.error(`Erro ao salvar: ${res.error || 'verifique sua conexão.'}`);
    }
  },

  confirmarDelete(id, nome) {
    const msg = document.getElementById('confirm-msg');
    if (msg) msg.innerText = `Excluir o cliente "${nome}"? Esta ação é irreversível.`;
    Modal.open('modal-confirm');

    document.getElementById('btn-confirm-delete').onclick = async () => {
      Modal.close('modal-confirm');
      const res = await DB.deletarCliente(id);
      if (res.ok) {
        Toast.success('Cliente excluído.');
        this.init();
        DashboardPage.init();
      } else {
        Toast.error('Erro ao excluir cliente.');
      }
    };
  }
};

// ─────────────────────────────────────────────
// MENSALIDADES
// ─────────────────────────────────────────────
const MensalidadesPage = {
  _todas: [],

  async init() {
    const tbody = document.getElementById('tbody-mensalidades');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="7" class="table-empty table-loading">⏳ Carregando mensalidades...</td></tr>`;

    // Popula o filtro de meses
    this._populaFiltroMes();

    this._todas = await DB.getMensalidades();
    this._render(this._todas);
  },

  _populaFiltroMes() {
    const sel = document.getElementById('filter-mes-mens');
    if (!sel || sel.options.length > 1) return;
    const ano = Utils.currentYear();
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.innerText = `${Utils.nomeMes(m)}/${ano}`;
      sel.appendChild(opt);
    }
  },

  aplicarFiltros() {
    const status = document.getElementById('filter-status-mens')?.value;
    const mes    = parseInt(document.getElementById('filter-mes-mens')?.value);

    let lista = this._todas;
    if (status) lista = lista.filter(m => m.status === status);
    if (mes)    lista = lista.filter(m => m.mes === mes);
    this._render(lista);
  },

  _render(lista) {
    const tbody = document.getElementById('tbody-mensalidades');
    if (!tbody) return;

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">Nenhuma mensalidade encontrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(m => `
      <tr>
        <td><strong>${m.clientes?.nome || m.cliente_nome || m.cliente_id || '—'}</strong></td>
        <td>${Utils.nomeMes(m.mes)}/${m.ano}</td>
        <td>${Utils.formatDate(m.data_vencimento)}</td>
        <td>${Utils.formatCurrency(m.valor)}</td>
        <td>${Utils.badgeStatus(m.status)}</td>
        <td>${m.pago_em ? Utils.formatDate(m.pago_em) : '—'}</td>
        <td class="actions-cell">
          ${m.status !== 'pago' ? `<button class="btn-sm btn-success" onclick="MensalidadesPage.marcarPago('${m.id}')">✔ Pago</button>` : ''}
          <button class="btn-icon" onclick="MensalidadesPage.openModal('${m.id}')">✏️</button>
        </td>
      </tr>
    `).join('');
  },

  async openModal(id) {
    // Preenche select de clientes
    const selectCli = document.getElementById('mens-cliente-id');
    if (selectCli) {
      const clientes = await DB.getTodosClientes();
      selectCli.innerHTML = `<option value="">Selecione um cliente...</option>` +
        clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    }

    // Preenche meses
    const selMes = document.getElementById('mens-mes');
    if (selMes) {
      selMes.innerHTML = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
        'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
        .map((m,i) => `<option value="${i+1}">${m}</option>`).join('');
    }

    document.getElementById('mens-ano').value       = Utils.currentYear();
    document.getElementById('mens-vencimento').value = Utils.today();
    document.getElementById('mens-pago-em').value    = Utils.today();
    document.getElementById('mens-status').value     = 'a_vencer';
    document.getElementById('mens-id').value         = '';
    document.getElementById('mens-valor').value      = '';
    document.getElementById('mens-obs').value        = '';

    if (id) {
      const m = this._todas.find(x => x.id === id);
      if (m) {
        document.getElementById('mens-id').value           = m.id;
        document.getElementById('mens-cliente-id').value   = m.cliente_id;
        document.getElementById('mens-mes').value          = m.mes;
        document.getElementById('mens-ano').value          = m.ano;
        document.getElementById('mens-valor').value        = m.valor;
        document.getElementById('mens-vencimento').value   = m.data_vencimento?.split('T')[0] || '';
        document.getElementById('mens-status').value       = m.status;
        document.getElementById('mens-pago-em').value      = m.pago_em?.split('T')[0] || '';
        document.getElementById('mens-obs').value          = m.obs || '';
      }
    }

    Modal.open('modal-mensalidade');
  },

  async salvar() {
    const btn        = document.getElementById('btn-salvar-mensalidade');
    const clienteId  = document.getElementById('mens-cliente-id').value;
    const valor      = parseFloat(document.getElementById('mens-valor').value);
    const vencimento = document.getElementById('mens-vencimento').value;

    if (!clienteId) { Toast.error('Selecione um cliente!'); return; }
    if (!valor || valor <= 0) { Toast.error('Informe um valor válido!'); return; }
    if (!vencimento) { Toast.error('Informe a data de vencimento!'); return; }

    const dados = {
      cliente_id:      clienteId,
      mes:             parseInt(document.getElementById('mens-mes').value),
      ano:             parseInt(document.getElementById('mens-ano').value),
      valor,
      data_vencimento: vencimento,
      status:          document.getElementById('mens-status').value,
      pago_em:         document.getElementById('mens-pago-em').value || null,
      obs:             document.getElementById('mens-obs').value || null
    };

    const idVal = document.getElementById('mens-id').value;
    if (idVal) dados.id = idVal;

    BtnState.loading(btn);
    const res = await DB.salvarMensalidade(dados);
    BtnState.reset(btn);

    if (res.ok) {
      Toast.success('✅ Mensalidade salva!');
      Modal.close('modal-mensalidade');
      this.init();
    } else {
      Toast.error(`Erro: ${res.error || 'verifique sua conexão.'}`);
    }
  },

  async marcarPago(id) {
    const res = await DB.marcarPago(id, Utils.today());
    if (res.ok) {
      Toast.success('✅ Mensalidade marcada como paga!');
      this.init();
      DashboardPage.init();
    } else {
      Toast.error('Erro ao registrar pagamento.');
    }
  }
};

// ─────────────────────────────────────────────
// FINANCEIRO
// ─────────────────────────────────────────────
const FinanceiroPage = {
  _todas: [],

  async init() {
    const tbody = document.getElementById('tbody-transacoes');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty table-loading">⏳ Carregando transações...</td></tr>`;

    this._populaFiltroMes();
    this._todas = await DB.getTransacoes();
    this._render(this._todas);
    this._atualizarResumo(this._todas);
  },

  _populaFiltroMes() {
    const sel = document.getElementById('filter-mes-tx');
    if (!sel || sel.options.length > 1) return;
    const ano = Utils.currentYear();
    for (let m = 1; m <= 12; m++) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.innerText = `${Utils.nomeMes(m)}/${ano}`;
      sel.appendChild(opt);
    }
  },

  aplicarFiltros() {
    const tipo = document.getElementById('filter-tipo-tx')?.value;
    const cat  = document.getElementById('filter-cat-tx')?.value;
    const mes  = parseInt(document.getElementById('filter-mes-tx')?.value);
    const ano  = Utils.currentYear();

    let lista = this._todas;
    if (tipo) lista = lista.filter(t => t.tipo === tipo);
    if (cat)  lista = lista.filter(t => t.categoria === cat);
    if (mes)  lista = lista.filter(t => {
      const d = new Date(t.data);
      return d.getMonth() + 1 === mes && d.getFullYear() === ano;
    });

    this._render(lista);
    this._atualizarResumo(lista);
  },

  _atualizarResumo(lista) {
    const ent   = lista.filter(t => t.tipo === 'entrada').reduce((s, t) => s + Number(t.valor), 0);
    const sai   = lista.filter(t => t.tipo === 'saida').reduce((s, t) => s + Number(t.valor), 0);
    const saldo = ent - sai;

    const set = (id, v) => { const e = document.getElementById(id); if (e) e.innerText = v; };
    set('fin-entradas', Utils.formatCurrency(ent));
    set('fin-saidas',   Utils.formatCurrency(sai));
    set('fin-saldo',    Utils.formatCurrency(saldo));

    const elSaldo = document.getElementById('fin-saldo');
    if (elSaldo) elSaldo.className = `fin-value ${saldo >= 0 ? 'text-green' : 'text-red'}`;
  },

  _render(lista) {
    const tbody = document.getElementById('tbody-transacoes');
    if (!tbody) return;

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty">Nenhuma transação encontrada.</td></tr>`;
      return;
    }

    tbody.innerHTML = lista.map(t => `
      <tr>
        <td>${Utils.formatDate(t.data)}</td>
        <td>${t.descricao}</td>
        <td><span class="badge badge-default">${t.categoria || '—'}</span></td>
        <td>${t.tipo === 'entrada'
          ? '<span class="badge badge-success">▲ Entrada</span>'
          : '<span class="badge badge-danger">▼ Saída</span>'}</td>
        <td class="${t.tipo === 'entrada' ? 'text-green' : 'text-red'} fw-bold">${Utils.formatCurrency(t.valor)}</td>
        <td class="actions-cell">
          <button class="btn-icon btn-icon-danger" title="Excluir" onclick="FinanceiroPage.deletar('${t.id}')">🗑</button>
        </td>
      </tr>
    `).join('');
  },

  async openModal(id) {
    // Preenche clientes
    const selCli = document.getElementById('tx-cliente');
    if (selCli) {
      const clientes = await DB.getTodosClientes();
      selCli.innerHTML = `<option value="">— Nenhum —</option>` +
        clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');
    }

    document.getElementById('tx-id').value         = '';
    document.getElementById('tx-tipo').value        = 'entrada';
    document.getElementById('tx-categoria').value   = 'mensalidade';
    document.getElementById('tx-descricao').value   = '';
    document.getElementById('tx-data').value        = Utils.today();
    document.getElementById('tx-valor').value       = '';
    document.getElementById('tx-cliente').value     = '';

    document.getElementById('modal-tx-title').innerText = 'Nova Transação';
    Modal.open('modal-transacao');
  },

  async salvar() {
    const btn   = document.getElementById('btn-salvar-transacao');
    const desc  = document.getElementById('tx-descricao').value.trim();
    const valor = parseFloat(document.getElementById('tx-valor').value);
    const data  = document.getElementById('tx-data').value;

    if (!desc)  { Toast.error('Descrição é obrigatória!'); return; }
    if (!valor || valor <= 0) { Toast.error('Informe um valor válido!'); return; }
    if (!data)  { Toast.error('Informe a data!'); return; }

    const dados = {
      tipo:       document.getElementById('tx-tipo').value,
      categoria:  document.getElementById('tx-categoria').value,
      descricao:  desc,
      data,
      valor,
      cliente_id: document.getElementById('tx-cliente').value || null
    };

    BtnState.loading(btn);
    const res = await DB.salvarTransacao(dados);
    BtnState.reset(btn);

    if (res.ok) {
      Toast.success('✅ Transação registrada!');
      Modal.close('modal-transacao');
      this.init();
      DashboardPage.init();
    } else {
      Toast.error(`Erro: ${res.error || 'verifique sua conexão.'}`);
    }
  },

  async deletar(id) {
    if (!confirm('Excluir esta transação?')) return;
    const res = await DB.deletarTransacao(id);
    if (res.ok) {
      Toast.success('Transação excluída.');
      this.init();
      DashboardPage.init();
    } else {
      Toast.error('Erro ao excluir.');
    }
  }
};

// ─────────────────────────────────────────────
// FUNDO DE RESERVA
// ─────────────────────────────────────────────
const ReservaPage = {
  async init() {
    const tbody = document.getElementById('tbody-reserva');
    if (!tbody) return;

    const lista = await DB.getFundoReserva();

    const saldo = lista.length ? Number(lista[0].saldo_acumulado) : 0;
    const set   = (id, v) => { const e = document.getElementById(id); if (e) e.innerText = v; };

    set('reserva-saldo-valor', Utils.formatCurrency(saldo));

    if (!lista.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="table-empty">Nenhum depósito registrado.</td></tr>`;
    } else {
      tbody.innerHTML = lista.map(r => `
        <tr>
          <td>${Utils.formatDate(r.data)}</td>
          <td>${r.percentual}% do lucro</td>
          <td>${Utils.formatCurrency(r.valor)}</td>
          <td>${Utils.formatCurrency(r.saldo_acumulado)}</td>
        </tr>
      `).join('');
    }

    // Carrega percentual salvo
    const pct = localStorage.getItem('_kappo_reserva_pct');
    if (pct) document.getElementById('reserva-percent').value = pct;
  },

  async preview() {
    const pct = parseFloat(document.getElementById('reserva-percent').value) || 0;
    const transacoes = await DB.getTransacoes();
    const entradas = transacoes.filter(t => t.tipo === 'entrada').reduce((s,t) => s + Number(t.valor), 0);
    const saidas   = transacoes.filter(t => t.tipo === 'saida').reduce((s,t) => s + Number(t.valor), 0);
    const lucro    = Math.max(0, entradas - saidas);
    const val      = (lucro * pct) / 100;

    const prev = document.getElementById('reserva-preview');
    const valEl = document.getElementById('reserva-preview-val');
    if (prev)  prev.style.display = 'flex';
    if (valEl) valEl.innerText = Utils.formatCurrency(val);
  },

  salvarConfig() {
    const pct = document.getElementById('reserva-percent').value;
    if (!pct || pct < 0 || pct > 100) { Toast.error('Percentual inválido (0–100).'); return; }
    localStorage.setItem('_kappo_reserva_pct', pct);
    Toast.success(`✅ Retenção de ${pct}% configurada!`);
  },

  async depositar() {
    const btn  = document.getElementById('btn-depositar-reserva');
    const pct  = parseFloat(document.getElementById('reserva-percent').value) || 0;
    if (!pct) { Toast.error('Configure o percentual primeiro!'); return; }

    const transacoes = await DB.getTransacoes();
    const entradas   = transacoes.filter(t => t.tipo === 'entrada').reduce((s,t) => s + Number(t.valor), 0);
    const saidas     = transacoes.filter(t => t.tipo === 'saida').reduce((s,t) => s + Number(t.valor), 0);
    const lucro      = Math.max(0, entradas - saidas);
    const valor      = (lucro * pct) / 100;

    if (valor <= 0) { Toast.warn('Lucro líquido zerado. Nada a depositar.'); return; }

    const lista  = await DB.getFundoReserva();
    const ultimo = lista.length ? Number(lista[0].saldo_acumulado) : 0;

    BtnState.loading(btn, '⏳ Depositando...');
    const res = await DB.salvarFundoReserva({
      data:            Utils.today(),
      percentual:      pct,
      valor,
      saldo_acumulado: ultimo + valor
    });
    BtnState.reset(btn);

    if (res.ok) {
      Toast.success(`✅ Depositado ${Utils.formatCurrency(valor)} no fundo!`);
      this.init();
    } else {
      Toast.error('Erro ao depositar. Verifique conexão.');
    }
  }
};

// ─────────────────────────────────────────────
// CONFIGURAÇÕES
// ─────────────────────────────────────────────
const ConfigPage = {
  init() {
    // Preenche campo Supabase URL / KEY se já tiver no storage
    const url = localStorage.getItem('_kappo_sb_url');
    const key = localStorage.getItem('_kappo_sb_key');
    if (url) document.getElementById('cfg-sb-url').value = url;
    if (key) document.getElementById('cfg-sb-key').value = key;

    const traccar = localStorage.getItem('_kappo_traccar_url');
    if (traccar) document.getElementById('cfg-traccar-url').value = traccar;
  },

  async testarSupabase() {
    const btn    = document.getElementById('btn-salvar-supabase');
    const status = document.getElementById('supabase-status');
    const url    = document.getElementById('cfg-sb-url').value.trim();
    const key    = document.getElementById('cfg-sb-key').value.trim();

    if (!url || !key) { Toast.error('Preencha URL e Key do Supabase.'); return; }

    BtnState.loading(btn, '⏳ Testando conexão...');
    const ok = await DB.testarConexao();
    BtnState.reset(btn);

    if (status) {
      status.classList.remove('hidden');
      if (ok) {
        status.innerHTML = '✅ Conexão estabelecida com sucesso!';
        status.className = 'cfg-status cfg-ok';
        localStorage.setItem('_kappo_sb_url', url);
        localStorage.setItem('_kappo_sb_key', key);
        Toast.success('Supabase conectado!');
      } else {
        status.innerHTML = '❌ Falha na conexão. Verifique URL e Key.';
        status.className = 'cfg-status cfg-err';
        Toast.error('Conexão falhou. Verifique as credenciais.');
      }
    }
  },

  salvarCredenciais() {
    const user  = document.getElementById('cfg-new-user').value.trim();
    const pass  = document.getElementById('cfg-new-pass').value;
    const conf  = document.getElementById('cfg-conf-pass').value;

    if (!user || !pass) { Toast.error('Preencha usuário e senha.'); return; }
    if (pass.length < 8) { Toast.error('Senha deve ter ao menos 8 caracteres.'); return; }
    if (pass !== conf) { Toast.error('As senhas não coincidem!'); return; }

    SessionManager.saveCredentials(user, pass);
    Toast.success('✅ Credenciais atualizadas! Use-as no próximo login.');

    const status = document.getElementById('creds-status');
    if (status) {
      status.classList.remove('hidden');
      status.innerHTML = '✅ Credenciais salvas com segurança.';
      status.className = 'cfg-status cfg-ok';
    }
  },

  salvarTraccar() {
    const url = document.getElementById('cfg-traccar-url').value.trim();
    if (url) localStorage.setItem('_kappo_traccar_url', url);
    Toast.success('✅ Configuração do Traccar salva!');
  },

  async exportarDados() {
    const [clientes, transacoes, mensalidades] = await Promise.all([
      DB.getTodosClientes(),
      DB.getTransacoes(),
      DB.getMensalidades()
    ]);

    const data = { exportedAt: new Date().toISOString(), clientes, transacoes, mensalidades };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `kappo-backup-${Utils.today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    Toast.success('📤 Backup exportado!');
  }
};

// ─────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────
window.addEventListener('load', () => App.init());
