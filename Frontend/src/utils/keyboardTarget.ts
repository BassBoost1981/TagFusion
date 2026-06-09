/**
 * True when a keyboard event targets a text-entry control, so global shortcuts
 * (delete, arrow navigation, …) should stand down and let the field handle the key.
 * Covers <input>, <textarea> and contentEditable hosts (e.g. rich tag editors).
 * Wahr, wenn ein Tastaturereignis ein Texteingabefeld betrifft — globale
 * Tastenkürzel sollen dann nicht greifen.
 */
export function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return true;
  if (target.isContentEditable) return true;
  const attr = target.getAttribute('contenteditable');
  return attr === '' || attr === 'true';
}
