# Hospedagem — avaliação (nada foi contratado nem alterado)

Requisitos reais: Next.js 15 com rotas de servidor Node (`node:crypto`/scrypt, `FormData`, ISR 30 s), site **comercial com anúncios**, Supabase, HTTPS e domínio próprio.

| Opção | Uso comercial/anúncios | Observações (fontes consultadas em 11/10/2026) |
|---|---|---|
| **Vercel Hobby** | **Proibido** | Fair Use: "Hobby teams are restricted to non-commercial personal use only"; inclusão de anúncios conta como uso comercial |
| **Vercel Pro** (recomendado) | Permitido | Suporte nativo ao Next 15/ISR, funções Node, domínio/HTTPS automáticos; faturamento por uso — confira preço em vercel.com/pricing |
| Cloudflare Workers (Free) | — | 100 mil req/dia e 10 ms de CPU por invocação; Next exige adaptador (OpenNext) e **não foi testado aqui**; o login (scrypt) pode estourar 10 ms. Plano pago a partir de US$ 5/mês |
| Supabase | — | Free pausa após 1 semana sem uso; Pro (a partir de US$ 25/mês) não pausa |

**Recomendação:** Vercel **Pro** + Supabase (Pro para produção). Você já usa essa stack. *Testado:* build de produção e servidor local. *Não testado:* deploy real, domínio, limites sob pico.

## Publicar (resumo)
1. Repositório Git privado (sem `.env*`).
2. Vercel → *Import Project* → configurar as variáveis de `.env.example` (Production) → Deploy.
3. Domínio: adicionar em *Settings → Domains* e criar no seu registrador os registros DNS indicados. **Verifique a disponibilidade e marca antes de comprar — não verifiquei.**
4. Após o deploy: `npm run smoke` com `BASE_URL=https://seu-dominio` e `npm run check:source` localmente.
5. Frequência: a home é regenerada a cada 30 s (ISR) e a fonte é consultada no máximo a cada 20 s por instância (60 s enquanto o arquivo não existe, para evitar bloqueio por 404 repetido — o TSE limita 100 req/s por IP).
