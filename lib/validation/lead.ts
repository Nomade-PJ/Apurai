export const LEAD_INTERESTS = [
  "Banner principal (topo)",
  "Bloco do patrocinador",
  "Bloco lateral (desktop)",
  "Bloco complementar (rodapé)",
  "Mais de um espaço / ainda não sei",
] as const;

export interface LeadInput {
  company: string;
  contact: string;
  email: string;
  interest: string;
  message: string;
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export function validateLead(raw: unknown): { ok: true; value: LeadInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim() : "");

  // Honeypot: campo "website" fica oculto para humanos; robôs costumam preenchê-lo.
  if (str("website") !== "") return { ok: false, errors: { _spam: "Envio rejeitado." } };

  const company = str("company");
  const contact = str("contact");
  const email = str("email");
  const interest = str("interest");
  const message = str("message");

  if (company.length < 2 || company.length > 120) errors.company = "Informe o nome da empresa (2 a 120 caracteres).";
  if (contact.length < 2 || contact.length > 120) errors.contact = "Informe seu nome completo (2 a 120 caracteres).";
  if (!EMAIL_RE.test(email) || email.length > 254) errors.email = "Informe um e-mail válido.";
  if (!(LEAD_INTERESTS as readonly string[]).includes(interest)) errors.interest = "Selecione o tipo de anúncio de interesse.";
  if (message.length < 10 || message.length > 1000) errors.message = "A mensagem deve ter de 10 a 1000 caracteres.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { company, contact, email, interest, message } };
}

/** Texto organizado que será pré-preenchido no WhatsApp (o usuário ainda precisa confirmar o envio lá). */
export function buildLeadMessage(l: LeadInput): string {
  return [
    "Olá! Tenho interesse em anunciar no Apuraí.",
    "",
    `Empresa: ${l.company}`,
    `Nome: ${l.contact}`,
    `E-mail: ${l.email}`,
    `Interesse: ${l.interest}`,
    "",
    `Mensagem: ${l.message}`,
  ].join("\n");
}
