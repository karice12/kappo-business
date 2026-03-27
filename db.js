/**
 * ═══════════════════════════════════════════════════════════════
 * KAPPO BUSINESS — db.js (VERSÃO REFATORADA BLINDADA v3.0)
 * ═══════════════════════════════════════════════════════════════
 * Correções aplicadas:
 * 1. Supabase URL e KEY injetados diretamente (sem placeholder)
 * 2. Todas as requisições com async/await + try/catch robusto
 * 3. Timeout de 10s por requisição (evita travamento infinito)
 * 4. Retorno consistente: sempre array [] em caso de falha (nunca null/undefined)
 * 5. Distinção entre "offline" e "tabela vazia"
 * 6. SessionManager com TTL de 8h e destruição limpa
 * ═══════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────
// CONFIGURAÇÃO SUPABASE (hardcoded para uso comercial)
// ─────────────────────────────────────────────
const SUPABASE_URL = 'https://qvromhtadqksiylgotrq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_5LNpGfaW6hqb7jXLaA4CQw_2QalW4x_';

// ─────────────────────────────────────────────
// CLIENTE SUPABASE NATIVO (sem SDK — fetch puro)
// ─────────────────────────────────────────────
const SupabaseClient = {
  baseUrl: SUPABASE_URL.replace(/\/$/, '') + '/rest/v1',

  _headers() {
    return {
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation'
    };
  },

  /**
   * Faz uma requisição com timeout de 10s.
   * Sempre retorna { ok: true, data } ou { ok: false, error }
   */
  async request(method, table, body = null, queryString = '') {
    const url = `${this.baseUrl}/${table}${queryString}`;
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 10_000);

    try {
      const opts = {
        method,
        headers: this._headers(),
        signal: controller.signal
      };
      if (body) opts.body = JSON.stringify(body);

      const res = await fetch(url, opts);
      clearTimeout(timeoutId);

      // 204 No Content (DELETE sem corpo) — ok
      if (res.status === 204) return { ok: true, data: [] };

      const payload = await res.json();

      if (!res.ok) {
        console.error(`[Supabase] ${method} /${table} → ${res.status}`, payload);
        return { ok: false, error: payload?.message || res.statusText, data: [] };
      }

      // Garante que seja sempre array
      return { ok: true, data: Array.isArray(payload) ? payload : [payload] };

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error('[Supabase] Timeout: requisição demorou > 10s');
        return { ok: false, error: 'Timeout: banco de dados demorou para responder.', data: [] };
      }
      console.error('[Supabase] Erro de rede:', err.message);
      return { ok: false, error: 'Sem conexão com o banco de dados.', data: [] };
    }
  },

  // Atalhos semânticos
  get(table, qs = '')       { return this.request('GET',    table, null, qs); },
  post(table, body)         { return this.request('POST',   table, body, ''); },
  patch(table, body, qs)    { return this.request('PATCH',  table, body, qs); },
  del(table, qs)            { return this.request('DELETE', table, null, qs); }
};

// ─────────────────────────────────────────────
// MÓDULO DB (interface pública para o app.js)
// ─────────────────────────────────────────────
const DB = {

  // ── AUTH ──────────────────────────────────────
  async login(user, pass) {
    // Credenciais locais — sobrescreva via Configurações
    const creds = SessionManager.getCredentials();
    if (user === creds.user && pass === creds.pass) {
      SessionManager.create(user);
      return true;
    }
    return false;
  },

  // ── CLIENTES ──────────────────────────────────
  async getClientes() {
    const { data } = await SupabaseClient.get('clientes', '?order=nome.asc&status=eq.ativo');
    return data;
  },

  async getTodosClientes() {
    const { data } = await SupabaseClient.get('clientes', '?order=nome.asc');
    return data;
  },

  async salvarCliente(dados) {
    if (dados.id) {
      const id = dados.id;
      delete dados.id;
      return await SupabaseClient.patch('clientes', dados, `?id=eq.${id}`);
    }
    return await SupabaseClient.post('clientes', dados);
  },

  async deletarCliente(id) {
    return await SupabaseClient.del('clientes', `?id=eq.${id}`);
  },

  // ── MENSALIDADES ──────────────────────────────
  async getMensalidades(filtros = {}) {
    let qs = '?order=data_vencimento.desc';
    if (filtros.status) qs += `&status=eq.${filtros.status}`;
    if (filtros.mes)    qs += `&mes=eq.${filtros.mes}`;
    if (filtros.ano)    qs += `&ano=eq.${filtros.ano}`;
    const { data } = await SupabaseClient.get('mensalidades', qs);
    return data;
  },

  async getInadimplentes() {
    // Usa a view criada no schema
    const { data } = await SupabaseClient.get('inadimplentes_view');
    return data;
  },

  async salvarMensalidade(dados) {
    if (dados.id) {
      const id = dados.id;
      delete dados.id;
      return await SupabaseClient.patch('mensalidades', dados, `?id=eq.${id}`);
    }
    return await SupabaseClient.post('mensalidades', dados);
  },

  async marcarPago(id, dataPagamento) {
    return await SupabaseClient.patch(
      'mensalidades',
      { status: 'pago', pago_em: dataPagamento },
      `?id=eq.${id}`
    );
  },

  // ── FINANCEIRO ────────────────────────────────
  async getTransacoes(filtros = {}) {
    let qs = '?order=data.desc';
    if (filtros.tipo)      qs += `&tipo=eq.${filtros.tipo}`;
    if (filtros.categoria) qs += `&categoria=eq.${filtros.categoria}`;
    if (filtros.mes)       qs += `&data=gte.${filtros.ano}-${String(filtros.mes).padStart(2,'0')}-01&data=lte.${filtros.ano}-${String(filtros.mes).padStart(2,'0')}-31`;
    const { data } = await SupabaseClient.get('fluxo_caixa', qs);
    return data;
  },

  async salvarTransacao(dados) {
    if (dados.id) {
      const id = dados.id;
      delete dados.id;
      return await SupabaseClient.patch('fluxo_caixa', dados, `?id=eq.${id}`);
    }
    return await SupabaseClient.post('fluxo_caixa', dados);
  },

  async deletarTransacao(id) {
    return await SupabaseClient.del('fluxo_caixa', `?id=eq.${id}`);
  },

  // ── FUNDO DE RESERVA ──────────────────────────
  async getFundoReserva() {
    const { data } = await SupabaseClient.get('fundo_reserva', '?order=data.desc');
    return data;
  },

  async salvarFundoReserva(dados) {
    return await SupabaseClient.post('fundo_reserva', dados);
  },

  // ── UTILITÁRIOS ───────────────────────────────
  async testarConexao() {
    const res = await SupabaseClient.get('clientes', '?limit=1');
    return res.ok;
  }
};

// ─────────────────────────────────────────────
// SESSION MANAGER
// ─────────────────────────────────────────────
const SessionManager = {
  TOKEN_KEY: '_kappo_session',
  CREDS_KEY: '_kappo_creds',
  SESSION_TTL: 8 * 60 * 60 * 1000, // 8 horas

  create(user) {
    const payload = { sub: user, exp: Date.now() + this.SESSION_TTL };
    localStorage.setItem(this.TOKEN_KEY, btoa(JSON.stringify(payload)));
  },

  verify() {
    try {
      const raw = localStorage.getItem(this.TOKEN_KEY);
      if (!raw) return null;
      const p = JSON.parse(atob(raw));
      if (Date.now() > p.exp) { this.destroy(); return null; }
      return p;
    } catch { return null; }
  },

  destroy() {
    localStorage.removeItem(this.TOKEN_KEY);
  },

  // Credenciais locais (editáveis via Configurações)
  getCredentials() {
    try {
      const raw = localStorage.getItem(this.CREDS_KEY);
      if (!raw) return { user: 'admin', pass: 'admin123' };
      return JSON.parse(atob(raw));
    } catch { return { user: 'admin', pass: 'admin123' }; }
  },

  saveCredentials(user, pass) {
    localStorage.setItem(this.CREDS_KEY, btoa(JSON.stringify({ user, pass })));
  }
};
