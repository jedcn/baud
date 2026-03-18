/**
 * Splits a command string on ` && `, returning trimmed non-empty parts.
 * e.g. "look && pick up diamond && south" → ["look", "pick up diamond", "south"]
 */
export function splitCommandChain(text: string): string[] {
  if (!text.includes(' && ')) return [text];
  return text.split(' && ').map(cmd => cmd.trim()).filter(cmd => cmd.length > 0);
}
