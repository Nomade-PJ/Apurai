# Supabase — configuração (nada foi aplicado ao seu projeto por mim)

## 1. Aplicar as migrações

Opção A — painel: **SQL Editor** → cole e execute, nesta ordem, os arquivos de `supabase/migrations/`:
1. `20261011120000_apurai_core_tables.sql`
2. `20261011120100_apurai_banner_storage.sql`
3. `20261012120000_apurai_ad_rotation.sql` (ordem e intervalo de rotação dos anúncios; aditiva, não altera dados existentes)

Opção B — CLI (PowerShell):
```powershell
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
```
As migrações são aditivas (`IF NOT EXISTS`) e não tocam em objetos existentes. Recomenda-se aplicá-las primeiro em um projeto/branch de teste.

## 2. Conferir (painel)
- **Table Editor**: `ads`, `leads`, `official_results` e `ad_slot_settings` com **RLS enabled** e **nenhuma policy**; `ads` com a coluna `sort_order`; `ad_slot_settings` com 4 linhas (topo, patrocinador, lateral, rodape).
- **Storage**: bucket `ad-banners` público (leitura), limite 512 KB, tipos png/jpeg/webp, **sem policies** de escrita.
- **Advisors** (Security): sem alertas para essas tabelas.

## 3. Credenciais (somente servidor)
Em **Project Settings → API**: copie a URL para `SUPABASE_URL` e a chave **service_role** (ou *secret key*) para `SUPABASE_SERVICE_ROLE_KEY` — nas variáveis do servidor
(`.env.local` e painel da hospedagem). Nunca use `NEXT_PUBLIC_` nessas variáveis nem as envie por chat.

## 4. Objetos antigos
Se uma tentativa anterior criou `poll_state`/`votes`, o Apuraí não os usa. Antes de removê-los, confira dependências (views, funções, outros apps) e faça backup; a remoção exige sua confirmação.

## 5. Plano
O plano gratuito **pausa projetos após 1 semana de inatividade** e limita banco (500 MB), storage (1 GB) e egress (5 GB) — conferido em supabase.com/pricing em 11/10/2026. Para produção comercial, avalie o plano Pro.

## Retenção de contatos (rotina manual)

A Política de privacidade informa que os contatos do formulário "Anuncie" ficam guardados por até **12 meses** após o último contato. Não há exclusão automática. Rode periodicamente no **SQL Editor** do Supabase:

```sql
-- 1) confira o que será apagado
select id, company, created_at from public.leads where created_at < now() - interval '12 months' order by created_at;
-- 2) apague (irreversível)
delete from public.leads where created_at < now() - interval '12 months';
```

Pedido de exclusão de um titular: `delete from public.leads where email = '<e-mail informado>';` (confira antes com `select`).

## Status (13/10/2026)

As três migrações estão aplicadas no projeto "Org Pessoal-Apurai". A verificação de segurança do Supabase mostra apenas avisos informativos "RLS habilitado sem policy" nas 4 tabelas, que são esperados: só o servidor, com a chave de serviço, acessa os dados.
