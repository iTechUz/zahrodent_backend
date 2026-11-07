/** One line, no control chars, length-capped (messages are plain text). */
export function oneLine(v: string | null | undefined, max: number): string {
  const t = (v ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
