/**
 * Free, dependency-free language heuristic for inbound message bodies.
 *
 * Returns the *primary* script so the EN-mode reading pane knows whether a
 * message needs translation + a "show original" toggle, and so AI generation
 * can target the right locale. No AI / network cost — a codepoint ratio:
 *   - 'ar'    Arabic-dominant (translate in EN mode)
 *   - 'en'    Latin-dominant  (no translation needed)
 *   - 'mixed' both present in roughly equal measure (translate, keep original handy)
 *   - null    too little textual signal to decide
 */
export type DetectedLanguage = 'ar' | 'en' | 'mixed';

export function detectLang(text: string | null | undefined): DetectedLanguage | null {
  if (!text) return null;
  const ar = (text.match(/[؀-ۿ]/g) || []).length;
  const la = (text.match(/[A-Za-z]/g) || []).length;
  const total = ar + la;
  if (total < 4) return null; // not enough letters to judge
  const arRatio = ar / total;
  if (arRatio > 0.65) return 'ar';
  if (arRatio < 0.15) return 'en';
  return 'mixed';
}
