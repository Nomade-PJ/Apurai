# Arquitetura

- **Next.js 15 (App Router) + TypeScript + Tailwind 3.** Dependências de runtime: `next`, `react`, `react-dom`, `@supabase/supabase-js`, `server-only`.
- **Camadas:** regras em `lib/` (puras e testadas) → rotas `app/api` finas → componentes. `lib/db` é `server-only` (a chave de serviço não entra em bundle de cliente).
- **Persistência** atrás de `Store` (`lib/db/store.ts`): `SupabaseStore` (produção) e `MemoryStore` (só dev/testes). Sem credenciais em produção, `getStore()` = `null` e recursos de banco ficam desativados.
- **Tabelas:** `ads`, `leads`, `official_results` (RLS ativo, sem policies; acesso só pelo servidor) + bucket `ad-banners` (leitura pública, escrita só pelo servidor).
- **Apuração:** `provider.ts` (timeout 8 s, 2 MB, ETag, TTL 20 s / 60 s em espera, dedupe de consultas, último resultado validado em memória e no Supabase) → `normalizer.ts` (EA20, validação estrita; zerado ⇒ *waiting*; `f = s` rejeitado) → `OfficialPanel`.
- **Home** com ISR de 30 s: HTML compartilhado entre visitantes; anúncios elegíveis são buscados uma vez por geração.
- **Anúncios:** elegibilidade (`lib/ads/schedule.ts`): ativo + período + destino https + banner desktop + alt; `pickAds` devolve os elegíveis de UM espaço na ordem de rotação (`lib/ads/order.ts`, máx. 8). `AdSlot` (servidor) renderiza 0 (nada), 1 (HTML estático) ou N anúncios (`AdRotator`, cliente). `AdFrame` reserva a proporção do espaço em CSS (`.ad-frame`), evitando salto de layout.
- **Banners:** regra única em `lib/ads/banner-rules.ts` (navegador e servidor); leitura de tipo/dimensões pelos bytes em `lib/validation/image.ts` (inclui orientação EXIF); formatos recomendados em `lib/ads/formats.ts`. Erros de persistência são tipados (`StorageError`, `SchemaPendingError`) e viram mensagens específicas ao administrador, sem expor detalhes do banco.
- **Configuração de exibição:** `ads.sort_order` e `ad_slot_settings` (intervalo por espaço) no Supabase; leitura com fallback para o padrão, para a página pública nunca quebrar.
- **Contato:** `/api/lead` valida, grava (se houver banco) e devolve o link `wa.me` montado a partir de `WHATSAPP_NUMBER`; o envio é confirmado pela pessoa no WhatsApp.
- **Segurança:** scrypt (hash sem `$`, compatível com `.env`), sessão HMAC 8 h, `HttpOnly`/`SameSite=Strict`/`Secure` (prod), Origin same-origin em POSTs, rate limit em memória (melhor esforço), CSP em `next.config.mjs` (mantém `'unsafe-inline'` por limitação do Next sem nonces).

## Limitações conhecidas
Rate limit e cache são por instância. Sem métricas de impressões/cliques. Integração real com TSE e Supabase **não** foi exercitada neste ambiente (sem acesso de rede/credenciais).
