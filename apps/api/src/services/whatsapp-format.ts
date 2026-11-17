/**
 * Markdown → WhatsApp text formatting. LLMs write `**bold**`; WhatsApp only understands `*bold*`,
 * `_italic_` and `~strike~`, so the outer pair stays visible ("*Producto:*" with extra asterisks).
 *
 * Pure and linear: every pattern works on ONE line, uses a single quantifier over a character
 * class that excludes its own delimiter (no nested quantifiers, no catastrophic backtracking).
 * Lone asterisks ("2 * 3 = 6"), text already in WhatsApp format ("*x*", "_x_"), numbers, prices,
 * emojis and URLs are left as they are.
 */

const BOLD = /\*\*([^*\n]+?)\*\*/g;
const ITALIC = /__([^_\n]+?)__/g;
const STRIKE = /~~([^~\n]+?)~~/g;
const LINK = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;
const HEADING = /^#{1,6}[ \t]+(\S.*)$/;

/** Bare http(s) URLs are never modified ("https://x.co/a__b__c" keeps its underscores). */
const URL_TOKEN = /https?:\/\/[^\s)]+/g;

function convertEmphasis(segment: string): string {
  return segment.replace(BOLD, '*$1*').replace(ITALIC, '_$1_').replace(STRIKE, '~$1~');
}

function convertInline(line: string): string {
  const withLinks = line.replace(LINK, '$1 ($2)');
  let out = '';
  let last = 0;
  for (const m of withLinks.matchAll(URL_TOKEN)) {
    out += convertEmphasis(withLinks.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + convertEmphasis(withLinks.slice(last));
}

function convertLine(line: string): string {
  const heading = HEADING.exec(line);
  if (!heading) return convertInline(line);
  // "## Resumen ##" → "Resumen"; an already bold title is not wrapped twice.
  let title = convertInline(heading[1]!).trimEnd();
  while (title.endsWith('#')) title = title.slice(0, -1);
  title = title.trimEnd();
  if (title === '') return line;
  return title.length > 1 && title.startsWith('*') && title.endsWith('*') ? title : `*${title}*`;
}

/** Converts the Markdown an LLM usually writes into WhatsApp formatting, line by line. */
export function toWhatsAppText(text: string): string {
  if (typeof text !== 'string' || text === '') return text;
  return text.split('\n').map(convertLine).join('\n');
}
