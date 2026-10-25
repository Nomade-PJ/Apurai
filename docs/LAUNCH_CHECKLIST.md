# Checklist de lançamento

Marque somente após **executar e verificar**.

## Já verificado localmente (sem integração real)
- [x] `npm test` (75), `npm run typecheck`, `npm run build`, `npm run smoke` (servidor local), `npm run verify:migrations` (Postgres local com stubs)

## Verificado nesta rodada (anúncios, compartilhar e login)
- [x] Testes de unidade/rota (Node + stubs de `next`), higiene do repositório e checagem de tipos de todo o projeto.
- [x] Comportamento em **Chromium real** (harness local, CSS Tailwind aproximado): rotação (ordem, pausa, limpeza de temporizadores, imagem quebrada, quadro estável), modal de compartilhar (copiar de verdade, Esc, clique fora, foco, celular 360 px), login (mostrar senha, estados, POST com `password`) e painel (validação de 14 arquivos de imagem reais, envio, exclusão com confirmação, ordem, intervalo).
- [ ] **Ainda por fazer (sua máquina):** `npm install && npm run typecheck && npm test && npm run build` e uma passada visual no navegador (o Tailwind real não foi usado nos testes de navegador).

## Banco de dados (Supabase) — situação em 13/10/2026
- [x] Migração `20261012120000_apurai_ad_rotation.sql` **aplicada** no projeto "Org Pessoal-Apurai" (aprovada pelo proprietário). Conferido no banco real: `ads.sort_order`, tabela `ad_slot_settings` com os 4 espaços a 8 s, RLS ativo sem policies, sem acesso de visitantes, índice e gatilho de `updated_at`. Teste funcional em transação desfeita: limites de `sort_order` e de intervalo (4–60) barram valores inválidos.
- [ ] **Ainda por fazer:** cadastrar 2 anúncios no mesmo espaço pelo painel (com o app apontando para esse Supabase) e conferir rotação, intervalo salvo e remoção de ponta a ponta; enviar o formulário "Anuncie" (cria um contato); rodar `npm run check:source` com o arquivo real da apuração.

## Textos legais e política de anúncios — situação
- [x] Termos de uso e Política de privacidade reescritos de forma completa, descrevendo o que o site faz de fato (LGPD: finalidade, base legal, transferência internacional para os EUA, retenção de 12 meses, direitos, ANPD). **Não foram revisados por advogado** e não são garantia de conformidade.
- [x] **Política de anúncios** (`/termos#anuncios`): não aceita propaganda eleitoral nem anúncios de candidatos, partidos, coligações ou campanhas (Lei nº 9.504/1997, art. 57-C). Aviso visível no formulário "Anuncie", na página Anuncie, na transparência e no painel do admin.
- [ ] Preencher `NEXT_PUBLIC_OPERATOR_NAME` (quem é o responsável pelos dados) e `NEXT_PUBLIC_CONTACT_EMAIL` com dados **reais**. Sem eles, as páginas mostram que a identificação "será informada antes do lançamento".
- [ ] **Rotina manual de retenção:** a política promete excluir contatos após 12 meses; isso NÃO é automático. Rodar o SQL de `docs/SUPABASE_SETUP.md` (seção "Retenção de contatos") periodicamente, e atender pedidos de exclusão.
- [ ] Opcional, recomendado antes de vender banners: consulta curta com advogado eleitoral/digital sobre (a) venda de espaço durante a eleição e (b) o enquadramento do operador como pessoa física ou jurídica (a regra do art. 57-C, §1º, I fala em sites de pessoas jurídicas).
- [ ] Conferir os termos de uso do arquivo de resultados em tempo real do TSE (a licença de atribuição que encontrei é a dos conjuntos do portal de dados abertos).
- [ ] Revisar cada anúncio antes de ativar (eles já nascem inativos): nada de candidatos, partidos, campanhas ou pedido de voto.

## Bloqueios antes de publicar
- [ ] `npm run check:source` no seu ambiente: confirma URL/código da eleição e o formato **real** do arquivo EA20 (a URL foi montada pela especificação; o TSE não pôde ser acessado daqui). Antes da apuração, 404 é esperado.
- [ ] Conferir `https://resultados.tse.jus.br/oficial/comum/config/ele-c.json` (códigos 6257/6258) e `lib/config/election.ts`.
- [ ] Aplicar migrações no Supabase e conferir RLS/bucket (`docs/SUPABASE_SETUP.md`); testar cadastro de anúncio, upload e leitura pública do banner **no Supabase real**.
- [ ] Configurar variáveis (`.env.example`) na hospedagem, incluindo `WHATSAPP_NUMBER` real e `NEXT_PUBLIC_CONTACT_EMAIL`.
- [ ] Hospedagem com uso comercial permitido (Vercel Pro; Hobby não) — `docs/HOSTING.md`. Domínio: verificar disponibilidade/marca; DNS e HTTPS.
- [ ] Revisão jurídica de privacidade e termos (LGPD, publicidade, regras eleitorais).
- [ ] `/admin`: login real, ativar/pausar anúncio, banner no Storage; `DEMO`/memória ausentes em produção.
- [ ] Revisão em celular real e leitor de tela; teste de carga proporcional ao plano; alertas de consumo (Vercel/Supabase).
- [ ] Simulação do dia da eleição (1º turno já ocorrido: use `ELECTION` 6257/turno 1 em um ambiente de teste para ver dados reais).
- [ ] Só afirmar que o site está no ar depois de publicar e verificar.
