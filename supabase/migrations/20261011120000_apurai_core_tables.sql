-- Apuraí — tabelas do produto final (sem enquete: NÃO existem poll_state nem votes).
-- Aditiva e idempotente (IF NOT EXISTS): não apaga nem altera nada que já exista no projeto.
-- Acesso: SOMENTE pelo servidor, com a chave de serviço (que ignora RLS). RLS ativo e SEM policies
-- para anon/authenticated => visitantes não leem nem escrevem nada diretamente pelo banco.

-- ---------------------------------------------------------------- função utilitária
create or replace function public.apurai_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- anúncios / campanhas
create table if not exists public.ads (
  id                 uuid primary key default gen_random_uuid(),
  campaign_name      text not null check (char_length(campaign_name) between 2 and 120),
  advertiser         text not null check (char_length(advertiser) between 2 and 120),
  position           text not null check (position in ('topo', 'patrocinador', 'lateral', 'rodape')),
  status             text not null default 'pausado' check (status in ('ativo', 'pausado', 'desativado')),
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  target_url         text not null check (target_url ~* '^https://[^[:space:]]+$' and char_length(target_url) <= 2000),
  -- caminhos de objeto no bucket "ad-banners" (não URLs)
  desktop_image_path text check (desktop_image_path is null or char_length(desktop_image_path) <= 300),
  mobile_image_path  text check (mobile_image_path is null or char_length(mobile_image_path) <= 300),
  alt_text           text not null check (char_length(alt_text) between 2 and 160),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint ads_period_valid check (ends_at > starts_at)
);

create index if not exists ads_slot_lookup_idx on public.ads (position, status, starts_at, ends_at);
create index if not exists ads_created_at_idx on public.ads (created_at desc);

drop trigger if exists ads_set_updated_at on public.ads;
create trigger ads_set_updated_at before update on public.ads
  for each row execute function public.apurai_set_updated_at();

-- ---------------------------------------------------------------- contatos comerciais
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  company    text not null check (char_length(company) between 2 and 120),
  contact    text not null check (char_length(contact) between 2 and 120),
  email      text not null check (char_length(email) between 5 and 254),
  interest   text not null check (char_length(interest) between 1 and 80),
  message    text not null check (char_length(message) between 10 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);

-- ---------------------------------------------------------------- último resultado oficial VALIDADO
-- Uma linha por eleição. Guarda apenas dado oficial já validado pelo servidor + metadados.
-- Nunca contém votos da comunidade nem dados simulados (o servidor rejeita f = 's' em produção).
create table if not exists public.official_results (
  election_code       integer primary key check (election_code > 0),
  round               smallint not null check (round in (1, 2)),
  snapshot            jsonb not null,
  source_generated_at timestamptz,
  fetched_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------- RLS: negar tudo a anon/authenticated
alter table public.ads              enable row level security;
alter table public.leads            enable row level security;
alter table public.official_results enable row level security;

revoke all on table public.ads, public.leads, public.official_results from anon, authenticated;
revoke execute on function public.apurai_set_updated_at() from anon, authenticated, public;

-- service_role ignora RLS (BYPASSRLS), mas precisa dos privilégios de tabela:
grant select, insert, update, delete on table public.ads, public.leads, public.official_results to service_role;
