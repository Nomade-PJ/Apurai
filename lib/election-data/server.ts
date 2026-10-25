import "server-only";
import { getStore } from "../db";
import { getOfficialState, type OfficialPersistence } from "./provider";
import type { OfficialState } from "./types";

/** Liga o provedor à persistência do servidor (Supabase). Falhas de banco nunca derrubam a apuração. */
export function getOfficialStateServer(): Promise<OfficialState> {
  const store = getStore();
  const persist: OfficialPersistence | null = store
    ? {
        load: async (code) => {
          const r = await store.getOfficial(code);
          return r ? { snapshot: r.snapshot, fetchedAt: r.fetchedAt } : null;
        },
        save: (rec) => store.saveOfficial(rec),
      }
    : null;
  return getOfficialState({ persist });
}
