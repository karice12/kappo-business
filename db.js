/**
 * ═══════════════════════════════════════════════════════════════
 * KAPPO BUSINESS — db.js (VERSÃO PRONTA PARA CONEXÃO)
 * ═══════════════════════════════════════════════════════════════
 */

/* ──────────────────────────────────────────────
   CONFIGURAÇÃO MANUAL DO BANCO DE DADOS
   ────────────────────────────────────────────── */
const SUPABASE_CONFIG = {
  url: 'https://qvromhtadqksiylgotrq.supabase.co', 
  key: 'sb_publishable_5LNpGfaW6hqb7jXLaA4CQw_2QalW4x_' 
};

/* ──────────────────────────────────────────────
   MÓDULO DE SEGURANÇA E SESSÃO
   ────────────────────────────────────────────── */
const CryptoUtils = {
  _getKey() {
    let k = localStorage.getItem('_kpk');
    if (!k) {
      k = btoa(Date.now().toString() + Math.random().toString(36));
      localStorage.setItem('_kpk', k);
    }
    return k;
  },
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
    } catch { return null; }
  },
  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'kappo_salt_2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
};

const SessionManager = {
  TOKEN_KEY: 'kappo_session',
  create(username) {
    const payload = { sub: username, exp: Date.now() + (8 * 60 * 60 * 1000) };
    localStorage.setItem(this.TOKEN_KEY, CryptoUtils.encrypt(payload));
  },
  verify() {
    const raw = localStorage.getItem(this.TOKEN_KEY);
    if (!raw) return null;
    const p = CryptoUtils.decrypt(raw);
    return (p && Date.now() < p.exp) ? p : null;
  },
  destroy() { localStorage.removeItem(this.TOKEN_KEY); }
};

/* ──────────────────────────────────────────────
   CONEXÃO SUPABASE
   ────────────────────────────────────────────── */
const SupabaseClient = {
  url: SUPABASE_CONFIG.url.replace(/\/$/, ''),
  key: SUPABASE_CONFIG.key,
  
  async request(method, table, data = null, query = '') {
    const endpoint = `${this.url}/rest/v1/${table}${query}`;
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
    return res.ok ? res.json() : [];
  }
};

/* ──────────────────────────────────────────────
   INTERFACE DO BANCO (DB)
   ────────────────────────────────────────────── */
const DB = {
  async login(username, password) {
    if (username === 'admin' && password === 'admin123') {
      SessionManager.create(username);
      return true;
    }
    return false;
  },

  async testConnection() {
    try {
      await SupabaseClient.request('GET', 'clientes', null, '?limit=1');
      return true;
    } catch { return false; }
  }
};

const LocalStore = {
  getClientes: () => [],
  getMensalidades: () => [],
  getTransacoes: () => [],
  getSupabaseConfig: () => ({ url: SUPABASE_CONFIG.url, key: SUPABASE_CONFIG.key }),
  saveSupabaseConfig: () => {}
};