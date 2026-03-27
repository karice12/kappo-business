# 🚀 Kappo Business — CRM/ERP Admin Panel

> Painel administrativo privado para gestão de empresa de rastreamento veicular.  
> Stack: HTML5 · CSS3 (Dark Cyberpunk) · Vanilla JS · Supabase (PostgreSQL)

---

## 📦 Estrutura de Arquivos

```
kappo-business/
├── index.html           # Estrutura completa da aplicação
├── styles.css           # Tema Dark/Cyberpunk Neon completo
├── db.js                # Módulo de dados (Supabase + LocalStorage)
├── app.js               # Lógica da aplicação
├── supabase-schema.sql  # Schema SQL para configurar o Supabase
├── vercel.json          # Config de deploy + headers de segurança
└── README.md            # Este arquivo
```

---

## ⚡ Deploy na Vercel (Gratuito)

### 1. Suba para o GitHub
```bash
git init
git add .
git commit -m "feat: Kappo Business v2.0"
git remote add origin https://github.com/SEU_USER/kappo-business.git
git push -u origin main
```

### 2. Deploy na Vercel
1. Acesse [vercel.com](https://vercel.com) → **New Project**
2. Importe o repositório do GitHub
3. Framework Preset: **Other**
4. Clique em **Deploy** ✅

---

## 🗄️ Configurar Supabase (Banco de Dados)

### 1. Criar projeto gratuito
1. Acesse [supabase.com](https://supabase.com) → **New Project**
2. Anote: **Project URL** e **anon public key** (em Settings → API)

### 2. Criar as tabelas
1. No Supabase: **SQL Editor** → **New Query**
2. Cole o conteúdo de `supabase-schema.sql`
3. Execute → ✅

### 3. Conectar no Kappo Business
1. Faça login no Kappo Business
2. Vá em **Configurações** → **Supabase**
3. Cole a URL e a chave anon
4. Clique em **Salvar e Testar Conexão**

---

## 🔑 Primeiro Acesso

| Campo | Padrão |
|-------|--------|
| Usuário | `admin` |
| Senha | `admin123` |

> ⚠️ **Altere a senha imediatamente** em Configurações → Credenciais de Acesso.

---

## 🔒 Segurança (LGPD)

- Sessões criptografadas com tokens baseados em `crypto.subtle` (SHA-256)
- TTL de sessão: **8 horas** (configurável em `db.js`)
- Dados locais criptografados via XOR + base64
- Headers de segurança: CSP, X-Frame-Options, nosniff (via `vercel.json`)
- RLS (Row Level Security) habilitado em todas as tabelas Supabase
- Nenhum dado sensível exposto no frontend sem necessidade

---

## 📋 Funcionalidades

### 📊 Dashboard
- Faturamento Bruto, Despesas, Lucro Líquido em tempo real
- Alerta de inadimplência com link direto para WhatsApp
- Últimas transações do fluxo de caixa

### 👥 Clientes (CRUD completo)
- Cadastro com: Nome, WhatsApp, E-mail, Nº veículos, Vencimento, Valor, Status
- Vínculo com ID do Traccar
- Busca por nome, e-mail ou WhatsApp
- Filtro por status (Ativo/Suspenso)
- Link direto para WhatsApp do cliente

### 💳 Mensalidades
- Status automático: **Pago** / **A Vencer** / **Atrasado**
- Marcar como pago com 1 clique (gera entrada no financeiro automaticamente)
- Filtro por mês e status
- Controle de dias em atraso

### 💰 Financeiro
- Fluxo de caixa completo (Entradas e Saídas)
- Categorias: Mensalidade, Chips M2M, Servidor AWS, Marketing, Outros
- Resumo financeiro do mês (Entradas / Saídas / Saldo)
- Filtros por tipo, categoria e mês

### 🛡️ Fundo de Reserva
- Configuração de % do lucro líquido para reserva
- Depósito manual com registro automático no fluxo de caixa
- Histórico de depósitos com saldo acumulado
- Indicador de meses de operação cobertos

### ⚙️ Configurações
- Conexão Supabase (URL + chave anon)
- Credenciais de acesso (usuário/senha)
- Integração Traccar
- Exportar backup JSON
- Limpar dados locais (demo)

---

## 🎨 Modo Demo

Ao abrir pela primeira vez (sem dados), o sistema carrega automaticamente:
- 6 clientes fictícios
- Mensalidades com status variados
- Transações de entrada e saída de demonstração

---

## 🛠️ Customização

### Categorias de despesa
Edite em `app.js` (FinanceiroPage.openModal) e no `supabase-schema.sql`.

### Tempo de sessão
Edite `SESSION_TTL` em `db.js` (padrão: 8 horas).

### Cores do tema
Edite as variáveis CSS em `styles.css` na seção `:root`.

---

## 📱 Responsividade

- ✅ Desktop (1280px+)
- ✅ Tablet (768px–1279px)
- ✅ Mobile (< 768px) com sidebar deslizante

---

## 🔗 Links Úteis

- [Supabase Docs](https://supabase.com/docs)
- [Traccar API](https://www.traccar.org/api-reference/)
- [Vercel Docs](https://vercel.com/docs)

---

**Kappo Business v2.0** — Desenvolvido para gestão profissional de rastreamento veicular.
