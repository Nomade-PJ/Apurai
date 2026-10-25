/** ISO (UTC) => "AAAA-MM-DDTHH:mm" no horário de Brasília, para <input type="datetime-local">. */
export function toBrtInput(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d); // "2026-10-11 09:31"
  return parts.replace(" ", "T");
}
