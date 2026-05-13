export function cleanLLMResponse(raw: string): string {
  let content = raw;
  // Strip <thought> blocks
  content = content.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();
  // Extract <response> content (with or without closing tag)
  const responseMatch = content.match(/<response>([\s\S]*?)(?:<\/response>|$)/i);
  if (responseMatch && responseMatch[1]) {
    content = responseMatch[1].trim();
  }
  return content;
}
