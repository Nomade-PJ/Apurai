/** Ordem de exibição dentro de um espaço: sortOrder crescente; empate => mais recente primeiro. */
export interface Orderable {
  id: string;
  sortOrder?: number;
  createdAt: string;
}

export const compareAds = (a: Orderable, b: Orderable) =>
  (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || Date.parse(b.createdAt) - Date.parse(a.createdAt);

/**
 * Planeja a troca de posição de um anúncio com o vizinho, renumerando o grupo (1..n).
 * Devolve null quando não há o que mover (já está na ponta ou id inexistente).
 */
export function planMove<T extends Orderable>(group: T[], id: string, direction: "up" | "down"): { id: string; sortOrder: number }[] | null {
  const list = [...group].sort(compareAds);
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return null;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return null;
  [list[i], list[j]] = [list[j], list[i]];
  return list.map((a, idx) => ({ id: a.id, sortOrder: idx + 1 }));
}
