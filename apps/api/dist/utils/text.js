"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripAndExtractToolCallArtifacts = stripAndExtractToolCallArtifacts;
exports.stripToolCallsXml = stripToolCallsXml;
/**
 * Strip tool call artifacts AND extract any leaked capture_variable calls.
 * Use this when you want to recover the variables the LLM meant to capture but
 * emitted as text instead of through the tool API.
 */
function stripAndExtractToolCallArtifacts(text) {
    if (!text)
        return { cleaned: '', extractedCaptures: [] };
    const extractedCaptures = [];
    let cleaned = text;
    // --- 1. XML-style tool call blocks ---
    // 1a. Closed pairs (precise match — strips only the tool call block).
    cleaned = cleaned.replace(/<tool_calls>[\s\S]*?<\/tool_calls>/gi, '');
    cleaned = cleaned.replace(/<function_calls>[\s\S]*?<\/function_calls>/gi, '');
    cleaned = cleaned.replace(/<invoke\s+name="[^"]*">[\s\S]*?<\/invoke>/gi, '');
    // 1b. Unclosed/truncated openers (defensive — happens when LLM output gets cut
    // mid-stream by maxTokens limit under heavy context). Strip from opener to end
    // of string since anything past an unclosed tool call opener is guaranteed
    // garbage (the LLM intended to emit a structured call, not user-facing text).
    // The downstream isMinimalResponse guard in message.worker.ts will then
    // trigger a retry without tools, producing a proper text response.
    cleaned = cleaned.replace(/<tool_calls>[\s\S]*$/i, '');
    cleaned = cleaned.replace(/<function_calls>[\s\S]*$/i, '');
    cleaned = cleaned.replace(/<invoke\s+name="[^"]*">[\s\S]*$/i, '');
    // --- 2 & 3. Fenced JSON blocks ---
    // Match ```json ... ``` OR ``` ... ``` where body contains a JSON-looking object.
    const fencedBlockRegex = /```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```/g;
    cleaned = cleaned.replace(fencedBlockRegex, (match, body) => {
        const capture = tryExtractCaptureFromJsonText(body);
        if (capture) {
            extractedCaptures.push(capture);
            return '';
        }
        // Not a capture_variable block — leave it alone (could be legitimate code/JSON).
        return match;
    });
    // --- 4. Bare JSON objects on their own lines that match capture_variable shape ---
    const bareJsonRegex = /(^|\n)(\s*\{[\s\S]*?\}\s*)(?=\n\s*\n|\n\s*```|\n\s*\{|\n?$)/g;
    cleaned = cleaned.replace(bareJsonRegex, (match, lead, body) => {
        const capture = tryExtractCaptureFromJsonText(body);
        if (capture) {
            extractedCaptures.push(capture);
            return lead;
        }
        return match;
    });
    // --- Cleanup: collapse excess whitespace ---
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    return { cleaned, extractedCaptures };
}
/**
 * Backwards-compatible wrapper: returns cleaned text only.
 * Kept so existing call sites that don't care about extracted captures still compile.
 * @deprecated Prefer stripAndExtractToolCallArtifacts for new code.
 */
function stripToolCallsXml(text) {
    return stripAndExtractToolCallArtifacts(text).cleaned;
}
/**
 * Attempt to parse a JSON-looking string and extract a capture_variable payload.
 * Supports both direct shape: { variable_name, variable_value }
 * and function_call shape: { name: "capture_variable", arguments: { variable_name, variable_value } }
 */
function tryExtractCaptureFromJsonText(raw) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{'))
        return null;
    // Quick shape check before parsing to avoid wasting cycles on code blocks
    if (!/"variable_name"|"variable_value"|"capture_variable"/.test(trimmed)) {
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(trimmed);
    }
    catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object')
        return null;
    const obj = parsed;
    // Direct shape: { variable_name: "...", variable_value: "..." }
    if (typeof obj['variable_name'] === 'string' &&
        typeof obj['variable_value'] !== 'undefined') {
        return {
            variableName: String(obj['variable_name']).trim(),
            variableValue: String(obj['variable_value']),
        };
    }
    // Function-call shape: { name: "capture_variable", arguments: {...} }
    if (obj['name'] === 'capture_variable' &&
        obj['arguments'] &&
        typeof obj['arguments'] === 'object') {
        const args = obj['arguments'];
        if (typeof args['variable_name'] === 'string' &&
            typeof args['variable_value'] !== 'undefined') {
            return {
                variableName: String(args['variable_name']).trim(),
                variableValue: String(args['variable_value']),
            };
        }
    }
    return null;
}
//# sourceMappingURL=text.js.map