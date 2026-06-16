const MAX_OCR_TEXT = 5000;

export function trimOcrText(text: string): string {
  const normalized = text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized.length <= MAX_OCR_TEXT) return normalized;
  return `${normalized.slice(0, MAX_OCR_TEXT - 1)}…`;
}
