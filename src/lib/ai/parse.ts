/**
 * Extracts a JSON object from model output that may be wrapped in markdown
 * code fences or surrounded by prose. Returns the raw JSON-ready substring.
 *
 * Some models (notably Claude via OpenRouter) wrap responses in ```json ... ```
 * even when response_format is set to json_object.
 */
export function extractJSON(content: string): string {
  const trimmed = content.trim();

  // ```json ... ``` or ``` ... ```
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenced && fenced[1]) return fenced[1].trim();

  // Strip a leading fence even if not closed, taking everything up to a closing fence
  // or the end of input.
  const leadingFence = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)(?:\n?```\s*)?$/);
  if (leadingFence && leadingFence[1] && trimmed.startsWith('```')) {
    return leadingFence[1].trim();
  }

  // Fallback: first '{' through matching last '}'.
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first !== -1 && last > first) return trimmed.slice(first, last + 1);

  return trimmed;
}

export function parseModelJSON(content: string): unknown {
  return JSON.parse(extractJSON(content));
}
