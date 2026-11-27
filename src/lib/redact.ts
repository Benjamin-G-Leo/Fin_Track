const KEEP = /^(cr|dr|from|to|by|on|ref|salary|payroll|rent|refund|emi|sip|loan|insurance|dividend|interest|maintenance|fees?|private|id|name|xxxx)$/i;

/**
 * Masks identifiers in bank text before it leaves the device. This is pattern based, so it reduces
 * what is shared but cannot promise to catch everything (a payee's name usually remains).
 */
export function redact(input: string, privateWords = ''): string {
  let text = input;
  // Words you listed are always masked, whatever the format.
  for (const word of privateWords.split(/[,\n]/).map((w) => w.trim()).filter((w) => w.length > 1)) {
    text = text.replace(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'gi'), '[private]');
  }
  // Bank transfers usually name a person: keep only words that help categorise.
  text = text.replace(/\b(NEFT|IMPS|RTGS)\b(.*)$/i, (_m, rail: string, rest: string) =>
    rail + rest.replace(/\b[a-z]{2,}\b/gi, (w) => (KEEP.test(w) ? w : '[name]')));
  return text
    // balances and limits
    .replace(/\b(?:avl\.?|available|clear|closing|total)?\s*(?:bal(?:ance)?|lmt|limit)\b[^\d\n]{0,12}[\d,]+(?:\.\d+)?/gi, ' ')
    // every e-mail address and UPI id
    .replace(/[\w.+-]+@[\w.-]+/g, '[id]')
    // card and Aadhaar numbers written in groups
    .replace(/\b\d{4}[ -]\d{6}[ -]\d{5}\b/g, 'XXXX')
    .replace(/\b\d{4}[ -]\d{4}[ -]\d{4}(?:[ -]\d{1,7})?\b/g, 'XXXX')
    // Indian mobile numbers, with or without +91 and a space
    .replace(/(?:\+91[ -]?|\b91[ -])?\b[6-9]\d{4}[ -]?\d{5}\b/g, 'XXXX')
    // PAN and IFSC codes
    .replace(/\b[a-z]{5}\d{4}[a-z]\b/gi, 'XXXX')
    .replace(/\b[a-z]{4}0[a-z0-9]{6}\b/gi, 'XXXX')
    // account and card numbers, including short masked tails
    .replace(/\b(a\/c|acct?|account|card)(\s*(?:no\.?|number|ending(?:\s+with)?)?\s*[:.-]?\s*)[x*]*\d{3,}/gi, '$1$2XXXX')
    .replace(/[x*]{2,}\s*\d{3,}/gi, 'XXXX')
    // reference numbers and any other long digit run
    .replace(/\b(ref(?:erence)?(?:\s*no)?|utr|rrn|txn\s*id)(\s*[:.#-]?\s*)[a-z]*\d[a-z\d]*/gi, '$1$2XXXX')
    .replace(/\d{8,}/g, 'XXXX')
    // greetings and honorifics
    .replace(/\b(dear|mr|mrs|ms|shri|smt)\b\.?\s+(?!(?:customer|upi|sir|user|card)\b)[a-z]+(?:\s+[A-Z][a-z]+)?/gi, '$1 [name]')
    .replace(/\s+/g, ' ')
    .trim();
}
