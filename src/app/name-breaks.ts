/**
 * Splits a field or table name after each underscore so a template can put a `<wbr>` there:
 * `context_free_discount_net_usage_num` wraps between words instead of mid-word, and copies unchanged.
 */
export function nameBreaks(name: unknown): string[] {
  const text = String(name ?? "");
  return text.includes("_") ? text.split(/(?<=_)/) : [text];
}
