/**
 * Configuração CENTRAL do contato comercial. Nenhum outro arquivo deve conter número de telefone.
 * Defina WHATSAPP_NUMBER (somente dígitos, com DDI e DDD; ex.: formato 55DDDNUMERO). Não é uma credencial,
 * mas é lido apenas no servidor; o navegador recebe somente o link pronto.
 */
export function whatsappNumber(env: Record<string, string | undefined> = process.env): string | null {
  const raw = (env.WHATSAPP_NUMBER ?? "").replace(/[\s()+-]/g, "");
  return /^\d{12,15}$/.test(raw) ? raw : null;
}

export function buildWhatsAppUrl(message: string, number: string | null = whatsappNumber()): string | null {
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}
