// Sovpadaet s USERNAME_PATTERN (lib/auth/synthetic-email.ts) — username'y
// vsegda nizhniy registr, poetomu tokeny iz teksta kommentariya privodim
// k nizhnemu registru pered poiskom po profiles.username.
const MENTION_PATTERN = /@([a-z0-9_.]{3,32})/gi;

export interface MentionableProfile {
  id: string;
  name: string;
  username: string;
}

export function extractMentionedUsernames(body: string): string[] {
  const usernames = new Set<string>();
  for (const match of body.matchAll(MENTION_PATTERN)) {
    usernames.add(match[1].toLowerCase());
  }
  return [...usernames];
}

export interface MentionSegment {
  text: string;
  mentionUsername: string | null;
}

// Dlya renderinga: razbivayet telo kommentariya na obychnyy tekst i
// @upominaniya, sohranyaya poziciyu — v otlichiye ot extractMentionedUsernames
// vyshe (tol'ko unikal'nyye username'y, bez konteksta).
export function splitMentionSegments(body: string): MentionSegment[] {
  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  for (const match of body.matchAll(MENTION_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) segments.push({ text: body.slice(lastIndex, index), mentionUsername: null });
    segments.push({ text: match[0], mentionUsername: match[1].toLowerCase() });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) segments.push({ text: body.slice(lastIndex), mentionUsername: null });
  return segments;
}
