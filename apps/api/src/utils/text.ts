/**
 * Strip XML tool call blocks that LLMs sometimes emit as plain text
 * instead of using native tool_use API. These should not be visible to users.
 */
export function stripToolCallsXml(text: string): string {
  // Remove <tool_calls>...</tool_calls> blocks (including nested content)
  let cleaned = text.replace(/<tool_calls>[\s\S]*?<\/tool_calls>/g, '');
  // Remove <function_calls>...</function_calls> blocks (alternative format)
  cleaned = cleaned.replace(/<function_calls>[\s\S]*?<\/function_calls>/g, '');
  // Remove standalone <invoke>...</invoke> blocks
  cleaned = cleaned.replace(/<invoke\s+name="[^"]*">[\s\S]*?<\/invoke>/g, '');
  // Clean up excess whitespace left behind
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}
