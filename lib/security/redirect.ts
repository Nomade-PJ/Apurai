import { NextResponse } from "next/server";

/**
 * Redirecionamento 303 com `Location` RELATIVO (ex.: "/admin").
 *
 * Por que não `NextResponse.redirect(new URL(path, req.url))`: o host em `req.url` pode não ser o que o navegador usou
 * (acesso por IP da rede em `next dev`, proxies, `HOSTNAME=0.0.0.0` em produção). Um `Location` absoluto para outro host é
 * cross-origin para a página e é BLOQUEADO pelo CSP `form-action 'self'` após o envio de um formulário. Um `Location` relativo é
 * sempre resolvido pelo navegador contra a origem que ele próprio usou. Só aceita caminhos do próprio site (sem open redirect).
 */
export function seeOther(path: string): NextResponse {
  if (!/^\/(?!\/)/.test(path) || /[\r\n\\]/.test(path)) throw new Error("seeOther aceita apenas caminhos relativos do próprio site");
  return new NextResponse(null, { status: 303, headers: { location: path } });
}
