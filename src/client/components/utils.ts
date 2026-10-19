/** Join conditional Tailwind class tokens. */
export function cn(...tokens: string[]): string {
  return tokens.filter(Boolean).join(" ");
}
