-- Apuraí — rotação de anúncios: ordem dentro do espaço e intervalo configurável por espaço.
-- ADITIVA e idempotente: não apaga nem altera dados existentes. Linhas antigas de "ads" recebem sort_order = 0.
-- Requer a função public.apurai_set_updated_at() criada na migração 20261011120000.

alter table public.ads
  add column if not exists sort_order integer not null default 0 check (sort_order between 0 and 100000);

create index if not exists ads_position_order_idx on public.ads (position, sort_order);

create table if not exists public.ad_slot_settings (
  position         text primary key check (position in ('topo', 'patrocinador', 'lateral', 'rodape')),
  rotation_seconds integer not null default 8 check (rotation_seconds between 4 and 60),
  updated_at       timestamptz not null default now()
);

drop trigger if exists ad_slot_settings_set_updated_at on public.ad_slot_settings;
create trigger ad_slot_settings_set_updated_at before update on public.ad_slot_settings
  for each row execute function public.apurai_set_updated_at();

insert into public.ad_slot_settings (position)
values ('topo'), ('patrocinador'), ('lateral'), ('rodape')
on conflict (position) do nothing;

-- Mesmo modelo de acesso das demais tabelas: RLS ativo, SEM policies; só o servidor (chave de serviço) lê/escreve.
alter table public.ad_slot_settings enable row level security;
revoke all on table public.ad_slot_settings from anon, authenticated;
grant select, insert, update, delete on table public.ad_slot_settings to service_role;
