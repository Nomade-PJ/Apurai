# Apuraí

Portal de acompanhamento da **apuração oficial** da eleição presidencial 2026 (TSE), com **anúncios administráveis**,
**contato comercial via WhatsApp** e compartilhamento. Next.js 15 (App Router) + Tailwind 3 + Supabase.

> A enquete da comunidade foi **removida por completo** (páginas, APIs, serviços, tabelas e variáveis). O Neon foi substituído pelo Supabase.

## Executar localmente

```powershell
npm install
Copy-Item .env.example .env.local     # preencha o que precisar (veja abaixo)
npm run dev                           # http://localhost:3000
npm test                              # lógica, rotas de API, banners/rotação e higiene do repositório
npm run typecheck; npm run build
```

Sem Supabase configurado, **fora de produção** o app usa armazenamento em memória (aviso visível no `/admin`). Em produção, sem Supabase,
anúncios/contatos ficam desativados — nunca memória.

## Variáveis de ambiente (veja `.env.example`)

| Variável | Onde | Observação |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | build/servidor | URL pública (sem barra final). Base de Open Graph, sitemap e links de compartilhamento |
| `SUPABASE_URL` | **servidor** | URL do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | **servidor, secreto** | Nunca `NEXT_PUBLIC_`. Só usada em `lib/db` |
| `ADMIN_PASSWORD_HASH` | servidor | `npm run hash-password -- "senha-forte-12+"` |
| `SESSION_SECRET` | servidor | ≥ 32 caracteres aleatórios |
| `WHATSAPP_NUMBER` | servidor | Só dígitos, DDI+DDD+número (`55DDDNUMERO`). Único lugar onde o número é configurado |
| `NEXT_PUBLIC_CONTACT_EMAIL` | público | E-mail real exibido nas páginas legais |
| `OFFICIAL_DATA_URL` / `OFFICIAL_DATA_LABEL` / `OFFICIAL_DATA_TTL_SECONDS` | servidor | Opcionais; padrão = URL EA20 derivada de `lib/config/election.ts` |
| `OFFICIAL_ALLOW_SIMULATED` | só dev | Aceita `f = "s"` fora de produção; ignorada em produção |

## Apuração oficial (TSE)

- Fonte: arquivo EA20 "resultado unificado", `https://resultados.tse.jus.br/oficial/ele2026/<eleição>/dados/br/br-c0001-e<6 dígitos>-u.json`
  (2º turno federal = eleição **6258**; 1º turno = 6257). Configuração em `lib/config/election.ts`.
- Estados: **ok**, **stale** (último resultado validado, horário explícito), **waiting** ("Aguardando o início da apuração oficial": 404, arquivo zerado ou sem votos),
  **error** (falha temporária sem dado válido). Nunca há números sem dado oficial validado; zero votos ≠ aguardando.
- Rejeita `f = "s"` (simulado) em produção, outra eleição/turno, estrutura ou tipos inválidos. Usa ETag e guarda o último resultado validado no Supabase (`official_results`).
- `pvap` é exibido como informado e rotulado conforme a especificação (votos computados do candidato ÷ votos votáveis concorrentes); o app não recalcula percentuais.
- **Valide no seu ambiente**: `npm run check:source` (baixa o arquivo real e mostra o resumo).

## Supabase

Migrações em `supabase/migrations/` (aditivas, RLS ativo, sem policies públicas, bucket `ad-banners`). Passo a passo: `docs/SUPABASE_SETUP.md`.

## Anúncios

`/admin` tem três áreas: **Novo anúncio** (nome, espaço, link, banner, “publicar assim que salvar”; período, texto alternativo e nome público ficam em *Opções avançadas*,
com padrões: nome do anúncio, início agora e 30 dias de duração), **Anúncios cadastrados** (miniatura, status Ativo/Inativo, ativar/desativar, editar, visualizar e remover com confirmação)
e **Exibição por espaço** (ordem de rotação com ↑/↓, intervalo de 4 a 60 s — padrão 8 s — e prévia ao vivo).

- **Rotação:** cada espaço alterna só os seus anúncios elegíveis (ativos, no período, com banner), na ordem definida (até 8 por espaço). Um único anúncio fica fixo, sem JavaScript;
  nenhum anúncio ⇒ o espaço **não é renderizado** (sem caixa, rótulo ou “Anuncie aqui”). A troca é um fade discreto (desligado com `prefers-reduced-motion`), o quadro mantém a proporção do
  espaço (sem salto de layout) e a rotação pausa com mouse/foco sobre o espaço, aba oculta ou espaço fora da tela. Imagem que falha ao carregar sai da rotação.
- **Banners:** PNG/JPG/WEBP até 512 KB, validados **pelos bytes** (não só extensão), no navegador antes do envio e de novo no servidor com a **mesma regra** (`lib/ads/banner-rules.ts`):
  recomendado = formato exato do espaço (`lib/ads/formats.ts`); aceito = proporção dentro de ±3% e largura de 0,6× a 3× da recomendada (ex.: 1940×180 para o espaço 970×90). Exibição com `object-fit: contain` (sem distorção).
  JPEG com orientação EXIF é medido como o navegador o exibe. Erros são específicos por campo (proporção, tamanho, peso, formato, arquivo ilegível). Quando a imagem tem outra proporção (ex.: 1440×756) ou passa de 512 KB, o painel oferece **Ajustar automaticamente**: gera no navegador um banner no tamanho do espaço (*Encaixar*: imagem inteira com laterais coloridas; *Preencher*: recorta o centro), com prévia antes de salvar; o arquivo gerado é revalidado no servidor como qualquer outro.
- **Persistência:** `ads` (+ `sort_order`), `ad_slot_settings` e bucket `ad-banners` no Supabase. A remoção apaga o registro e **somente** os arquivos do próprio anúncio, e só se nenhum outro registro os usa.
  A página pública é atualizada logo após cada alteração do painel (`revalidatePath`) ou em até 30 s.
- **Migração pendente?** Sem `20261012120000_apurai_ad_rotation.sql`, o site segue exibindo anúncios (intervalo padrão) e o painel avisa “migração pendente” ao reordenar/salvar intervalo. Veja `docs/SUPABASE_SETUP.md`.

## Política de anúncios e textos legais

`/termos#anuncios` define que o Apuraí **não aceita propaganda eleitoral** (nem anúncios de candidatos, partidos, coligações ou campanhas; Lei nº 9.504/1997, art. 57-C). O aviso aparece no formulário "Anuncie", na página Anuncie, na transparência e no painel do admin; anúncios nascem inativos para revisão. `/privacidade` descreve a coleta real do site (LGPD), a retenção de 12 meses (rotina manual em `docs/SUPABASE_SETUP.md`) e a transferência de dados para os EUA (Supabase). Defina `NEXT_PUBLIC_OPERATOR_NAME` e `NEXT_PUBLIC_CONTACT_EMAIL`. Os textos não foram revisados por advogado.

## Compartilhar

O botão **Compartilhar** (tela de apuração) abre um modal (`<dialog>` nativo: Esc, clique fora, botão Fechar, foco contido, rolagem travada) com WhatsApp, Facebook, X, Telegram, LinkedIn,
Copiar link (com confirmação) e, quando existir, a Web Share API. A URL usa `NEXT_PUBLIC_SITE_URL`/domínio de produção (nunca `localhost` em produção); só o link público e um texto genérico são compartilhados.

## Login do painel

Tela centralizada e responsiva, com mostrar/ocultar senha (só alterna o `type` do campo), estados de foco/carregamento/erro e área de mensagem de altura fixa (sem deslocamento do layout).
O envio continua sendo o POST nativo para `/api/admin/login` (scrypt + cookie HMAC, rate limit, Origin): nada da autenticação foi alterado.

## Segurança

Admin com scrypt + cookie HMAC (`HttpOnly`, `SameSite=Strict`, `Secure` em produção), checagem no servidor em toda rota de escrita, Origin/CSRF, rate limit
(melhor esforço em serverless), validação de entrada e de imagens pelos **bytes**, CSP e cabeçalhos em `next.config.mjs`. Erros do banco nunca chegam ao visitante.

## Hospedagem

Veja `docs/HOSTING.md` (a Vercel **Hobby não permite** site com anúncios) e `docs/LAUNCH_CHECKLIST.md`.

## Estrutura

`app/` rotas e APIs · `components/` UI · `lib/election-data` fonte oficial · `lib/db` persistência (Supabase/memória) · `lib/ads` · `lib/validation` · `lib/security` ·
`supabase/migrations` · `tests/` · `scripts/` (`smoke.mjs`, `check-source.ts`, `verify-migrations.mjs`) · `docs/`.
