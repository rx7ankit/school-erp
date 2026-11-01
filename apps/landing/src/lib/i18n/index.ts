import { en, type Dict } from "./en";

export type { Dict };

/** All page copy lives in en.ts. Kept as a hook-shaped helper so components read `useT().section.key`. */
export function useT(): Dict {
  return en;
}
