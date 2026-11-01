/**
 * A dictionary file exports `defineDict({ en: {...}, hi: {...} })`.
 * TypeScript makes `hi` have exactly the same keys as `en`, so a missing translation fails the build.
 * Use `{name}` placeholders for values: t("key", { name: "Aarav" }).
 */
export function defineDict<K extends string>(d: { en: Record<K, string>; hi: Record<K, string> }) {
  return d;
}
