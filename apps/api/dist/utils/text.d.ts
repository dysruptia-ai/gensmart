/**
 * Tool call artifacts that sometimes leak into the LLM's text response instead of
 * coming through the native tool_use API. These must never be shown to end users,
 * and when possible, should be converted back into real tool calls so the
 * underlying action (e.g., capture_variable) actually runs.
 *
 * Covered formats:
 *   1. XML blocks (closed pairs):  <tool_calls>...</tool_calls>,
 *                                  <function_calls>...</function_calls>,
 *                                  <invoke name="...">...</invoke>
 *   1b. XML blocks (unclosed/truncated openers): strips from <tool_calls>,
 *       <function_calls>, or <invoke name="..."> to end-of-string. Handles
 *       cases where maxTokens cut the model's output mid-tool-call.
 *   2. Fenced JSON blocks with capture_variable shape:
 *        ```json
 *        { "variable_name": "nombre", "variable_value": "Kai" }
 *        ```
 *      (also ``` without the `json` language tag)
 *   3. Fenced JSON blocks with function_call shape:
 *        ```json
 *        { "name": "capture_variable", "arguments": { "variable_name": "...", "variable_value": "..." } }
 *        ```
 *   4. Bare JSON objects (not inside fences) that match the capture_variable shape,
 *      appearing on their own line(s).
 */
export interface ExtractedCaptureCall {
    variableName: string;
    variableValue: string;
}
export interface StripResult {
    /** Cleaned text with all tool call artifacts removed. */
    cleaned: string;
    /** Capture calls recovered from the leaked artifacts, ordered by appearance. */
    extractedCaptures: ExtractedCaptureCall[];
}
/**
 * Strip tool call artifacts AND extract any leaked capture_variable calls.
 * Use this when you want to recover the variables the LLM meant to capture but
 * emitted as text instead of through the tool API.
 */
export declare function stripAndExtractToolCallArtifacts(text: string): StripResult;
/**
 * Backwards-compatible wrapper: returns cleaned text only.
 * Kept so existing call sites that don't care about extracted captures still compile.
 * @deprecated Prefer stripAndExtractToolCallArtifacts for new code.
 */
export declare function stripToolCallsXml(text: string): string;
//# sourceMappingURL=text.d.ts.map