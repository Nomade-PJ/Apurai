# Supabase — migrações do Apuraí

Arquivos em `migrations/` (ordem alfabética = ordem de aplicação):

1. `20261011120000_apurai_core_tables.sql` — `ads`, `leads`, `official_results` (RLS ativo, sem policies públicas).
2. `20261011120100_apurai_banner_storage.sql` — bucket público de leitura `ad-banners` (sem policies de escrita).
3. `20261012120000_apurai_ad_rotation.sql` — `ads.sort_order` (ordem de rotação) e tabela `ad_slot_settings` (intervalo por espaço; RLS ativo, sem policies). **Necessária para ordenar anúncios e salvar o intervalo**; sem ela o site continua exibindo anúncios (rotação com intervalo padrão de 8 s) e o painel mostra aviso de migração pendente.

São **aditivas** (`IF NOT EXISTS`): não removem nem alteram objetos existentes. Elas **não** criam nem apagam `poll_state`/`votes`.
Se esses objetos existirem no seu projeto de uma tentativa anterior, o Apuraí não os usa; remova-os somente depois de
conferir dependências (ver `docs/SUPABASE_SETUP.md`).

Aplicação: veja `docs/SUPABASE_SETUP.md`.
