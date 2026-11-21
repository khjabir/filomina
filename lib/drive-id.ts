/** Extracts a Google Drive folder/file ID from a pasted link or bare ID. Isomorphic. */
export function extractDriveId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]{10,})/,
    /[?&]id=([a-zA-Z0-9_-]{10,})/,
    /\/d\/([a-zA-Z0-9_-]{10,})/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
  return null;
}
