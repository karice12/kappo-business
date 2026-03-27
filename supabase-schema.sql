-- ═══════════════════════════════════════════════════════════════
-- KAPPO BUSINESS — Supabase Schema (PostgreSQL)
-- Execute este SQL no Supabase SQL Editor para criar as tabelas
-- ═══════════════════════════════════════════════════════════════

-- Extensão para UUIDs
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- TABELA: usuarios_admin
-- ─────────────────────────────────────────────
create table if not exists usuarios_admin (
  id          uuid primary key default uuid_generate_v4(),
  username    varchar(100) not null unique,
  email       varchar(255) not null unique,
  password_hash text not null,
  role        varchar(50) default 'admin_master',
  ativo       boolean default true,
  created_at  timestamptz default now(),
  last_login  timestamptz
);

-- RLS: somente usuários autenticados
alter table usuarios_admin enable row level security;
create policy "Admin only" on usuarios_admin
  for all using (auth.uid() is not null);

-- ─────────────────────────────────────────────
-- TABELA: clientes
-- ─────────────────────────────────────────────
create table if not exists clientes (
  id              uuid primary key default uuid_generate_v4(),
  nome            varchar(255) not null,
  whatsapp        varchar(20),
  email           varchar(255),
  traccar_id      varchar(100),       -- ID do dispositivo no Traccar
  veiculos        int default 1,
  dia_vencimento  int check (dia_vencimento between 1 and 31),
  valor_mensal    decimal(10,2) default 0,
  status          varchar(20) default 'ativo' check (status in ('ativo','suspenso')),
  obs             text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table clientes enable row level security;
create policy "Admin read clientes" on clientes
  for all using (auth.uid() is not null);

-- ─────────────────────────────────────────────
-- TABELA: mensalidades
-- ─────────────────────────────────────────────
create table if not exists mensalidades (
  id              uuid primary key default uuid_generate_v4(),
  cliente_id      uuid references clientes(id) on delete cascade,
  mes             int not null check (mes between 1 and 12),
  ano             int not null,
  valor           decimal(10,2) not null,
  data_vencimento date not null,
  status          varchar(20) default 'a_vencer' check (status in ('pago','a_vencer','atrasado')),
  pago_em         date,
  obs             text,
  _tx_created     boolean default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table mensalidades enable row level security;
create policy "Admin read mensalidades" on mensalidades
  for all using (auth.uid() is not null);

-- Índices para performance
create index if not exists idx_mens_status on mensalidades(status);
create index if not exists idx_mens_cliente on mensalidades(cliente_id);
create index if not exists idx_mens_vencimento on mensalidades(data_vencimento);

-- ─────────────────────────────────────────────
-- TABELA: fluxo_caixa (transações)
-- ─────────────────────────────────────────────
create table if not exists fluxo_caixa (
  id          uuid primary key default uuid_generate_v4(),
  tipo        varchar(10) not null check (tipo in ('entrada','saida')),
  categoria   varchar(50) not null check (categoria in ('mensalidade','chips_m2m','servidor','marketing','outros')),
  descricao   varchar(500) not null,
  data        date not null,
  valor       decimal(10,2) not null,
  cliente_id  uuid references clientes(id) on delete set null,
  created_at  timestamptz default now()
);

alter table fluxo_caixa enable row level security;
create policy "Admin read fluxo_caixa" on fluxo_caixa
  for all using (auth.uid() is not null);

create index if not exists idx_fluxo_tipo on fluxo_caixa(tipo);
create index if not exists idx_fluxo_data on fluxo_caixa(data);
create index if not exists idx_fluxo_categoria on fluxo_caixa(categoria);

-- ─────────────────────────────────────────────
-- TABELA: fundo_reserva
-- ─────────────────────────────────────────────
create table if not exists fundo_reserva (
  id              uuid primary key default uuid_generate_v4(),
  data            date not null,
  percentual      decimal(5,2) not null,
  valor           decimal(10,2) not null,
  saldo_acumulado decimal(10,2) not null,
  created_at      timestamptz default now()
);

alter table fundo_reserva enable row level security;
create policy "Admin read fundo" on fundo_reserva
  for all using (auth.uid() is not null);

-- ─────────────────────────────────────────────
-- VIEW: inadimplentes_view
-- ─────────────────────────────────────────────
create or replace view inadimplentes_view as
  select
    m.id as mensalidade_id,
    c.id as cliente_id,
    c.nome,
    c.whatsapp,
    m.mes,
    m.ano,
    m.valor,
    m.data_vencimento,
    current_date - m.data_vencimento as dias_atraso
  from mensalidades m
  join clientes c on c.id = m.cliente_id
  where m.status = 'atrasado'
  order by m.data_vencimento asc;

-- ─────────────────────────────────────────────
-- FUNÇÃO: auto-update updated_at
-- ─────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_clientes_updated_at
  before update on clientes
  for each row execute function update_updated_at();

create trigger trg_mensalidades_updated_at
  before update on mensalidades
  for each row execute function update_updated_at();

-- ─────────────────────────────────────────────
-- INSERT ADMIN PADRÃO (altere a senha!)
-- ─────────────────────────────────────────────
-- insert into usuarios_admin (username, email, password_hash, role)
-- values ('admin', 'admin@kappo.com', 'HASH_DA_SENHA_AQUI', 'admin_master');

-- ═══════════════════════════════════════════════════════════════
-- FIM DO SCHEMA
-- ═══════════════════════════════════════════════════════════════
