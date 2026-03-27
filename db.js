const SUPABASE_CONFIG = {
  url: 'https://qvromhtadqksiylgotrq.supabase.co',
  key: 'sb_publishable_5LNpGfaW6hqb7jXLaA4CQw_2QalW4x_' // Usei a chave que você enviou antes
};

const DB = {
  async query(method, table, data = null, params = '') {
    const url = `${SUPABASE_CONFIG.url}/rest/v1/${table}${params}`;
    try {
      const res = await fetch(url, {
        method: method,
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: data ? JSON.stringify(data) : null
      });
      return res.ok ? await res.json() : [];
    } catch (e) { return []; }
  },

  async login(u, p) {
    if (u === 'admin' && p === 'admin123') {
      localStorage.setItem('_kappo_session', 'active');
      return true;
    }
    return false;
  },

  async getClientes() { return await this.query('GET', 'clientes', null, '?order=nome.asc'); },
  async getFinanceiro() { return await this.query('GET', 'financeiro', null, '?order=data.desc'); }
};