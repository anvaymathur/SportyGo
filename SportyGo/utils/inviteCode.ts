/**
 * Pulls the invite code out of whatever someone pastes or types: the bare code ("aB3_x-"), or a
 * whole invite link ("https://sportygo-sparkpro.web.app/groups/aB3_x-"). Returns null when there
 * is nothing usable. Codes are case-sensitive.
 */
export function parseInviteCode(input: string | undefined | null): string | null {
  const text = (input ?? '').trim();
  if (!text) return null;
  // For a link, the code is the last path segment (ignoring any query string or trailing slash)
  const withoutQuery = text.split(/[?#]/)[0].replace(/\/+$/, '');
  const candidate = withoutQuery.includes('/') ? withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1) : withoutQuery;
  return /^[A-Za-z0-9_-]{4,32}$/.test(candidate) ? candidate : null;
}
