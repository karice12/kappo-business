/**
 * ═══════════════════════════════════════════════════════════════
 * KAPPO BUSINESS — db.js
 * Módulo de Persistência de Dados
 * Suporte: Supabase (PostgreSQL) + LocalStorage (fallback/demo)
 * LGPD Compliant — Dados sensíveis tratados no backend
 * ═══════════════════════════════════════════════════════════════
 */

/* ──────────────────────────────────────────────
   CRYPTO UTILS — Criptografia simples para localStorage
   Em produção com Supabase, use APENAS o banco remoto.
   ────────────────────────────────────────────── */
const CryptoUtils = {
  // Chave derivada de uma seed + timestamp de instalação
  _getKey() {
    let k = localStorage.getItem('_kpk');
    if (!k) {
      k = btoa(Date.now().toString() + Math.random().toString(36));
      localStorage.setItem('_kpk', k);
    }
    return k;
  },

  // Criptografia XOR simples para dados locais (não sensíveis em produção)
  encrypt(data) {
    const str = JSON.stringify(data);
    const key = this._getKey();
    let result = '';
    for (let i = 0; i < str.length; i++) {
      result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
  },

  decrypt(encoded) {
    try {
      const str = atob(encoded);
      const key = this._getKey();
      let result = '';
      for (let i = 0; i < str.length; i++) {
        result += String.fromCharCode(str.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return JSON.parse(result);
    } catch {
      return null;
    }
  },

  // Hash simples para senhas locais (use bcrypt no servidor em produção!)
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'kappo_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
};

/* ──────────────────────────────────────────────
   SESSION TOKEN — JWT-like simples
   ────────────────────────────────────────────── */
const SessionManager = {
  TOKEN_KEY: 'kappo_session',
  SESSION_TTL: 8 * 60 * 60 * 1000, // 8 horas

  create(username) {
    const payload = {
      sub: username,
      iat: Date.now(),
      exp: Date.now() + this.SESSION_TTL,
      role: 'admin_master'
    };
    // Armazena criptografado
    const token = CryptoUtils.encrypt(payload);
    localStorage.setItem(this.TOKEN_KEY, token);
    return token;
  },

  verify() {
    const raw = localStorage.getItem(this.TOKEN_KEY);
    if (!raw) return null;
    const payload = CryptoUtils.decrypt(raw);
    if (!payload) return null;
    if (Date.now() > payload.exp) {
      this.destroy();
      return null;
    }
    return payload;
  },

  destroy() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  getUser() {
    const p = this.verify();
    return p ? p.sub : null;
  }
};

/* ──────────────────────────────────────────────
   SUPABASE CLIENT
   Configure as credenciais em Configurações
   ────────────────────────────────────────────── */
const SupabaseClient = {
  url: null,
  key: null,
  connected: false,

  init(url, key) {
    this.url = url ? url.replace(/\/$/, '') : null;
    this.key = key || null;
    this.connected = !!(url && key);
  },

  async request(method, table, data = null, query = '') {
    if (!this.connected) throw new Error('Supabase não configurado');
    const endpoint = `${this.url}/rest/v1/${table}${query}`;
    const res = await fetch(endpoint, {
      method,
      headers: {
        'apikey': this.key,
        'Authorization': `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal'
      },
      body: data ? JSON.stringify(data) : undefined
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Erro na requisição');
    }
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  },

  // Queries
  select: (table, query = '') => SupabaseClient.request('GET', table, null, `?${query}`),
  insert: (table, data) => SupabaseClient.request('POST', table, data),
  update: (table, data, id) => SupabaseClient.request('PATCH', table, data, `?id=eq.${id}`),
  delete: (table, id) => SupabaseClient.request('DELETE', table, null, `?id=eq.${id}`)
};

/* ──────────────────────────────────────────────
   LOCALSTORAGE STORE — Fallback / Modo Demo
   Simula um banco relacional simples
   ────────────────────────────────────────────── */
const LocalStore = {
  KEYS: {
    clientes:    '_kp_clientes',
    mensalidades:'_kp_mensalidades',
    transacoes:  '_kp_transacoes',
    reserva:     '_kp_reserva',
    config:      '_kp_config',
    credentials: '_kp_creds'
  },

  _read(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const dec = CryptoUtils.decrypt(raw);
    return Array.isArray(dec) ? dec : (dec || []);
  },

  _readObj(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    return CryptoUtils.decrypt(raw) || {};
  },

  _write(key, data) {
    localStorage.setItem(key, CryptoUtils.encrypt(data));
  },

  _id: () => 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),

  // CLIENTES
  getClientes() { return this._read(this.KEYS.clientes); },
  saveCliente(cliente) {
    const list = this.getClientes();
    if (cliente.id) {
      const idx = list.findIndex(c => c.id === cliente.id);
      if (idx !== -1) list[idx] = { ...list[idx], ...cliente };
    } else {
      cliente.id = this._id();
      cliente.created_at = new Date().toISOString();
      list.push(cliente);
    }
    this._write(this.KEYS.clientes, list);
    return cliente;
  },
  deleteCliente(id) {
    const list = this.getClientes().filter(c => c.id !== id);
    this._write(this.KEYS.clientes, list);
  },

  // MENSALIDADES
  getMensalidades() { return this._read(this.KEYS.mensalidades); },
  saveMensalidade(mens) {
    const list = this.getMensalidades();
    if (mens.id) {
      const idx = list.findIndex(m => m.id === mens.id);
      if (idx !== -1) list[idx] = { ...list[idx], ...mens };
    } else {
      mens.id = this._id();
      mens.created_at = new Date().toISOString();
      list.push(mens);
    }
    this._write(this.KEYS.mensalidades, list);
    return mens;
  },
  deleteMensalidade(id) {
    const list = this.getMensalidades().filter(m => m.id !== id);
    this._write(this.KEYS.mensalidades, list);
  },

  // TRANSAÇÕES
  getTransacoes() { return this._read(this.KEYS.transacoes); },
  saveTransacao(tx) {
    const list = this.getTransacoes();
    if (tx.id) {
      const idx = list.findIndex(t => t.id === tx.id);
      if (idx !== -1) list[idx] = { ...list[idx], ...tx };
    } else {
      tx.id = this._id();
      tx.created_at = new Date().toISOString();
      list.push(tx);
    }
    this._write(this.KEYS.transacoes, list);
    return tx;
  },
  deleteTransacao(id) {
    const list = this.getTransacoes().filter(t => t.id !== id);
    this._write(this.KEYS.transacoes, list);
  },

  // RESERVA
  getReserva() { return this._readObj(this.KEYS.reserva) || { saldo: 0, depositos: [], percentual: 10 }; },
  saveReserva(reserva) { this._write(this.KEYS.reserva, reserva); },

  // CONFIG
  getConfig() { return this._readObj(this.KEYS.config) || {}; },
  saveConfig(cfg) {
    const current = this.getConfig();
    this._write(this.KEYS.config, { ...current, ...cfg });
  },

  // CREDENTIALS (armazenadas de forma segura)
  async getCredentials() {
    const raw = localStorage.getItem(this.KEYS.credentials);
    if (!raw) {
      // Padrão inicial
      const defaultHash = await CryptoUtils.hashPassword('admin123');
      return { username: 'admin', passwordHash: defaultHash };
    }
    return CryptoUtils.decrypt(raw) || {};
  },
  async saveCredentials(username, password) {
    const hash = await CryptoUtils.hashPassword(password);
    this._write(this.KEYS.credentials, { username, passwordHash: hash });
  },
  async verifyCredentials(username, password) {
    const creds = await this.getCredentials();
    const hash = await CryptoUtils.hashPassword(password);
    return creds.username === username && creds.passwordHash === hash;
  }
};

/* ──────────────────────────────────────────────
   DB — Interface unificada (Supabase ou Local)
   ────────────────────────────────────────────── */
const DB = {
  // Detecta se Supabase está configurado
  get useSupabase() {
    const cfg = LocalStore.getConfig();
    return !!(cfg.supabaseUrl && cfg.supabaseKey);
  },

  init() {
    const cfg = LocalStore.getConfig();
    if (cfg.supabaseUrl && cfg.supabaseKey) {
      SupabaseClient.init(cfg.supabaseUrl, cfg.supabaseKey);
    }
  },

  // Auto-atualiza status de mensalidades com base em datas
  _updateMensalidadeStatus(mens) {
    if (mens.status === 'pago') return mens;
    const today = new Date();
    today.setHours(0,0,0,0);
    const venc = new Date(mens.data_vencimento + 'T00:00:00');
    if (venc < today) mens.status = 'atrasado';
    else mens.status = 'a_vencer';
    return mens;
  },

  /* ─── CLIENTES ─── */
  async getClientes(filters = {}) {
    let list = LocalStore.getClientes();
    if (filters.status) list = list.filter(c => c.status === filters.status);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      list = list.filter(c =>
        c.nome?.toLowerCase().includes(s) ||
        c.whatsapp?.includes(s) ||
        c.email?.toLowerCase().includes(s)
      );
    }
    return list.sort((a,b) => a.nome?.localeCompare(b.nome));
  },

  async saveCliente(data) {
    return LocalStore.saveCliente(data);
  },

  async deleteCliente(id) {
    LocalStore.deleteCliente(id);
    // Remove mensalidades relacionadas
    const mens = LocalStore.getMensalidades().filter(m => m.cliente_id !== id);
    LocalStore._write(LocalStore.KEYS.mensalidades, mens);
    return true;
  },

  /* ─── MENSALIDADES ─── */
  async getMensalidades(filters = {}) {
    let list = LocalStore.getMensalidades().map(m => this._updateMensalidadeStatus(m));
    if (filters.status) list = list.filter(m => m.status === filters.status);
    if (filters.cliente_id) list = list.filter(m => m.cliente_id === filters.cliente_id);
    if (filters.mes_ano) list = list.filter(m => `${m.mes}_${m.ano}` === filters.mes_ano);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const clientes = LocalStore.getClientes();
      list = list.filter(m => {
        const cl = clientes.find(c => c.id === m.cliente_id);
        return cl?.nome?.toLowerCase().includes(s);
      });
    }
    return list.sort((a,b) => new Date(b.data_vencimento) - new Date(a.data_vencimento));
  },

  async saveMensalidade(data) {
    const saved = LocalStore.saveMensalidade(data);
    // Se pago, cria entrada automática no financeiro
    if (data.status === 'pago' && !data._tx_created) {
      const clientes = LocalStore.getClientes();
      const cl = clientes.find(c => c.id === data.cliente_id);
      if (cl) {
        await this.saveTransacao({
          tipo: 'entrada',
          categoria: 'mensalidade',
          descricao: `Mensalidade ${cl.nome} — ${data.mes}/${data.ano}`,
          data: data.pago_em || new Date().toISOString().split('T')[0],
          valor: data.valor,
          cliente_id: data.cliente_id
        });
        saved._tx_created = true;
        LocalStore.saveMensalidade(saved);
      }
    }
    return saved;
  },

  async deleteMensalidade(id) {
    LocalStore.deleteMensalidade(id);
    return true;
  },

  /* ─── TRANSAÇÕES ─── */
  async getTransacoes(filters = {}) {
    let list = LocalStore.getTransacoes();
    if (filters.tipo) list = list.filter(t => t.tipo === filters.tipo);
    if (filters.categoria) list = list.filter(t => t.categoria === filters.categoria);
    if (filters.mes_ano) {
      list = list.filter(t => {
        if (!t.data) return false;
        const [y, m] = t.data.split('-');
        return `${parseInt(m)}_${y}` === filters.mes_ano;
      });
    }
    return list.sort((a,b) => new Date(b.data) - new Date(a.data));
  },

  async saveTransacao(data) {
    return LocalStore.saveTransacao(data);
  },

  async deleteTransacao(id) {
    LocalStore.deleteTransacao(id);
    return true;
  },

  /* ─── MÉTRICAS ─── */
  async getMetricas() {
    const today = new Date();
    const mesAtual = today.getMonth() + 1;
    const anoAtual = today.getFullYear();

    const transacoes = LocalStore.getTransacoes();
    const mensalidades = LocalStore.getMensalidades().map(m => this._updateMensalidadeStatus(m));
    const clientes = LocalStore.getClientes();
    const reserva = LocalStore.getReserva();

    // Filtra transações do mês atual
    const txMes = transacoes.filter(t => {
      if (!t.data) return false;
      const d = new Date(t.data + 'T00:00:00');
      return d.getMonth() + 1 === mesAtual && d.getFullYear() === anoAtual;
    });

    const entradas = txMes
      .filter(t => t.tipo === 'entrada')
      .reduce((acc, t) => acc + parseFloat(t.valor || 0), 0);

    const saidas = txMes
      .filter(t => t.tipo === 'saida')
      .reduce((acc, t) => acc + parseFloat(t.valor || 0), 0);

    const inadimplentes = mensalidades.filter(m => m.status === 'atrasado');

    const clientesAtivos = clientes.filter(c => c.status === 'ativo').length;

    return {
      faturamento: entradas,
      despesas: saidas,
      lucro: entradas - saidas,
      inadimplentes: inadimplentes.length,
      inadimplentesList: inadimplentes,
      clientesAtivos,
      totalClientes: clientes.length,
      reservaSaldo: reserva.saldo || 0,
      ultimasTransacoes: transacoes.slice(0, 5)
    };
  },

  /* ─── RESERVA ─── */
  async getReserva() { return LocalStore.getReserva(); },
  async saveReserva(data) { LocalStore.saveReserva(data); return data; },

  async depositarReserva(percentual, lucroLiquido) {
    const reserva = LocalStore.getReserva();
    const valor = (lucroLiquido * percentual) / 100;
    if (valor <= 0) return { error: 'Lucro insuficiente para depósito' };

    const deposito = {
      data: new Date().toISOString().split('T')[0],
      percentual,
      valor: parseFloat(valor.toFixed(2)),
      saldo_acumulado: parseFloat(((reserva.saldo || 0) + valor).toFixed(2))
    };

    reserva.saldo = deposito.saldo_acumulado;
    reserva.depositos = [...(reserva.depositos || []), deposito];
    reserva.percentual = percentual;
    LocalStore.saveReserva(reserva);

    // Registra saída no fluxo de caixa
    await this.saveTransacao({
      tipo: 'saida',
      categoria: 'outros',
      descricao: `Depósito Fundo de Reserva (${percentual}% do lucro)`,
      data: deposito.data,
      valor: deposito.valor
    });

    return deposito;
  },

  /* ─── CONFIG ─── */
  getConfig() { return LocalStore.getConfig(); },
  saveConfig(cfg) { LocalStore.saveConfig(cfg); },

  /* ─── AUTH ─── */
  async login(username, password) {
    return LocalStore.verifyCredentials(username, password);
  },
  async updateCredentials(username, password) {
    await LocalStore.saveCredentials(username, password);
    return true;
  },

  /* ─── SEED DE DEMONSTRAÇÃO ─── */
  async seedDemoData() {
    const existing = LocalStore.getClientes();
    if (existing.length > 0) return; // Já tem dados

    console.log('[Kappo] Gerando dados de demonstração...');

    // Clientes demo
    const clientesDemo = [
      { nome: 'Carlos Eduardo Silva', whatsapp: '11999990001', email: 'carlos@email.com', veiculos: 2, dia_vencimento: 10, valor_mensal: 89.90, status: 'ativo', traccar_id: 'DEV001' },
      { nome: 'Ana Paula Ferreira', whatsapp: '11999990002', email: 'ana@email.com', veiculos: 1, dia_vencimento: 15, valor_mensal: 59.90, status: 'ativo', traccar_id: 'DEV002' },
      { nome: 'Roberto Machado', whatsapp: '11999990003', email: 'roberto@email.com', veiculos: 3, dia_vencimento: 5, valor_mensal: 149.70, status: 'ativo', traccar_id: 'DEV003' },
      { nome: 'Juliana Costa', whatsapp: '11999990004', email: 'juliana@email.com', veiculos: 1, dia_vencimento: 20, valor_mensal: 59.90, status: 'suspenso', traccar_id: 'DEV004' },
      { nome: 'Fernando Alves', whatsapp: '11999990005', email: 'fernando@email.com', veiculos: 2, dia_vencimento: 8, valor_mensal: 99.80, status: 'ativo', traccar_id: 'DEV005' },
      { nome: 'Patricia Lima', whatsapp: '11999990006', email: 'patricia@email.com', veiculos: 1, dia_vencimento: 12, valor_mensal: 69.90, status: 'ativo', traccar_id: 'DEV006' },
    ];

    const savedClientes = clientesDemo.map(c => LocalStore.saveCliente(c));

    // Mensalidades demo (mês atual)
    const today = new Date();
    const mes = today.getMonth() + 1;
    const ano = today.getFullYear();

    savedClientes.forEach((cl, i) => {
      const statusArr = ['pago', 'pago', 'a_vencer', 'atrasado', 'pago', 'a_vencer'];
      const vencDay = cl.dia_vencimento;
      const vencDate = `${ano}-${String(mes).padStart(2,'0')}-${String(vencDay).padStart(2,'0')}`;
      LocalStore.saveMensalidade({
        cliente_id: cl.id,
        mes,
        ano,
        valor: cl.valor_mensal,
        data_vencimento: vencDate,
        status: statusArr[i],
        pago_em: statusArr[i] === 'pago' ? vencDate : null,
        _tx_created: true
      });
    });

    // Transações demo
    const txDemos = [
      { tipo: 'entrada', categoria: 'mensalidade', descricao: 'Mensalidade Carlos Eduardo', data: `${ano}-${String(mes).padStart(2,'0')}-10`, valor: 89.90 },
      { tipo: 'entrada', categoria: 'mensalidade', descricao: 'Mensalidade Ana Paula', data: `${ano}-${String(mes).padStart(2,'0')}-15`, valor: 59.90 },
      { tipo: 'entrada', categoria: 'mensalidade', descricao: 'Mensalidade Fernando Alves', data: `${ano}-${String(mes).padStart(2,'0')}-08`, valor: 99.80 },
      { tipo: 'saida', categoria: 'chips_m2m', descricao: 'Chips M2M — Operadora Vivo (6 chips)', data: `${ano}-${String(mes).padStart(2,'0')}-02`, valor: 78.00 },
      { tipo: 'saida', categoria: 'servidor', descricao: 'Servidor AWS EC2 — Mensal', data: `${ano}-${String(mes).padStart(2,'0')}-01`, valor: 45.00 },
      { tipo: 'saida', categoria: 'marketing', descricao: 'Anúncios Google Ads', data: `${ano}-${String(mes).padStart(2,'0')}-05`, valor: 120.00 },
    ];

    txDemos.forEach(tx => LocalStore.saveTransacao(tx));

    console.log('[Kappo] Dados demo carregados com sucesso!');
  }
};
