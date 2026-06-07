export function truncateHash(h: string): string {
  if (!h || !h.startsWith("0x")) return h;
  if (h.length <= 18) return h;
  return `${h.slice(0, 10)}…${h.slice(-6)}`;
}

export function isAddress(s: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(s);
}
