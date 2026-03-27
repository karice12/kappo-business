const SUPABASE_CONFIG = {
  url: 'https://qvromhtadqksiylgotrq.supabase.co', 
  key: sb_publishable_5LNpGfaW6hqb7jXLaA4CQw_2QalW4x_ 
};

const SupabaseClient = {
  url: SUPABASE_CONFIG.url.replace(/\/$/, ''),
  key: SUPABASE_CONFIG.key,
  async request(method, table, data = null, query = '') {
    const endpoint = `${this.url}/rest/v1/${table}${query}`;
    try {
      const res = await fetch(endpoint, {
        method,
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: data ? JSON.stringify(data) : undefined
      });
      return res.ok ? await res.json() : [];
    } catch (err) {
      console.error("Erro Supabase:", err);
      return [];
    }
  }
};

const DB = {
  async login(u, p) {
    if (u === 'admin' && p === 'admin123') {
      SessionManager.create(u);
      return true;
    }
    return false;
  },
  async getClientes() { return await SupabaseClient.request('GET', 'clientes', null, '?order=nome.asc'); },
  async salvarCliente(d) { return await SupabaseClient.request('POST', 'clientes', d); },
  async getTransacoes() { return await SupabaseClient.request('GET', 'financeiro', null, '?order=data.desc'); },
  async salvarTransacao(d) { return await SupabaseClient.request('POST', 'financeiro', d); }
};

const SessionManager = {
  TOKEN_KEY: '_kappo_session',
  create(u) { localStorage.setItem(this.TOKEN_KEY, btoa(JSON.stringify({sub:u, exp:Date.now()+(8*60*60*1000)}))); },
  verify() {
    const t = localStorage.getItem(this.TOKEN_KEY);
    if(!t) return null;
    const p = JSON.parse(atob(t));
    return Date.now() < p.exp ? p : null;
  },
  destroy() { localStorage.removeItem(this.TOKEN_KEY); }
};