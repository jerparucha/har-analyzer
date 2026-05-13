const NUMERIC     = /^\d+$/;
const UUID        = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PURE_HEX    = /^[0-9a-f]+$/i;

function looksLikeId(seg: string): boolean {
  if (NUMERIC.test(seg)) return true;
  if (UUID.test(seg)) return true;
  // Pure hex string ≥ 16 chars (e.g. MongoDB ObjectId, SHA hash prefix)
  if (seg.length >= 16 && PURE_HEX.test(seg)) return true;
  // Long alphanumeric token ≥ 12 chars containing both letters and digits
  if (seg.length >= 12 && /[a-zA-Z]/.test(seg) && /[0-9]/.test(seg) && /^[a-zA-Z0-9_-]+$/.test(seg)) return true;
  return false;
}

export function normalizeUrlPath(url: string): string {
  try {
    const u = new URL(url);
    const normalized = u.pathname
      .split('/')
      .map(seg => (seg && looksLikeId(seg) ? '{id}' : seg))
      .join('/');
    return normalized;
  } catch {
    return url;
  }
}
