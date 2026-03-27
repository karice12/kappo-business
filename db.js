const SUPABASE_CONFIG = {
  url: 'https://qvromhtadqksiylgotrq.supabase.co', 
  key: 'sb_publishable_5LNpGfaW6hqb7jXLaA4CQw_2QalW4x_' 
};

const DB = {
  // Função mestre para falar com o Supabase
  async query(method, table, data = null, queryParams = '') {
    const url = `${SUPABASE_CONFIG.url}/rest/v1/${table}${queryParams}`;
    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'apikey': SUPABASE_CONFIG.key,
          'Authorization': `Bearer ${SUPABASE_CONFIG.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: data ? JSON.stringify(data) : null
      });
      if (!response.ok) return [];
      return await response.json();
    } catch (err) {
      console.error("Erro de conexão:", err);
      return [];
    }
  },

  async login(u, p) {
    if (u === 'admin' && p === 'admin123') {
      localStorage.setItem('_session', btoa(u));
      return true;
    }
    return false;
  },

  // Busca dados reais do banco
  async getClientes() { return await this.query('GET', 'clientes', null, '?order=nome.asc'); },
  async getFinanceiro() { return await this.query('GET', 'financeiro', null, '?order=data.desc'); },
  async salvarCliente(dados) { return await this.query('POST', 'clientes', dados); }
};