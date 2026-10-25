import "server-only";
import { createClient } from "@supabase/supabase-js";
import { memoryStoreAllowed, supabaseConfig } from "../env";
import { MemoryStore, type Store } from "./store";
import { SupabaseStore } from "./supabase-store";

const g = globalThis as unknown as { __apuraiStore?: Store };

/**
 * Retorna a persistência disponível ou null.
 * - Com SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY: Supabase (única opção válida em produção).
 * - Sem credenciais: MemoryStore SOMENTE fora de produção.
 * - Caso contrário: null => anúncios, contatos e cache de resultados ficam desativados (nunca memória em produção).
 */
export function getStore(): Store | null {
  if (g.__apuraiStore) return g.__apuraiStore;
  const cfg = supabaseConfig();
  if (cfg) {
    const client = createClient(cfg.url, cfg.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    return (g.__apuraiStore = new SupabaseStore(client, cfg.url));
  }
  if (memoryStoreAllowed()) return (g.__apuraiStore = new MemoryStore());
  return null;
}
