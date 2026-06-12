import { ToolDefinition, ToolCall } from './llm.service';
import type { ExtractedCaptureCall } from '../utils/text';
export interface AgentVariable {
    name: string;
    type: 'string' | 'number' | 'email' | 'phone' | 'enum';
    required?: boolean;
    description?: string;
    options?: string[];
    mapsTo?: string;
}
/** Build variable capture instructions to append to the system prompt */
export declare function buildVariableCaptureInstructions(variables: AgentVariable[]): string;
/** Tool definition to register with the LLM */
export declare const captureVariableToolDef: ToolDefinition;
interface CaptureResult {
    success: boolean;
    message: string;
}
/** Handle a capture_variable tool call from the LLM */
export declare function handleCaptureVariable(conversationId: string, variableName: string, variableValue: string, agentVariables: AgentVariable[], io?: import('socket.io').Server): Promise<CaptureResult>;
/**
 * Convert capture calls extracted from leaked text artifacts into synthetic
 * ToolCall objects so the worker's normal tool loop can process them.
 * Each synthetic call gets a unique ID prefixed with `synthetic_capture_`
 * so it's distinguishable in logs.
 */
export declare function extractedCapturesToToolCalls(extracted: ExtractedCaptureCall[]): ToolCall[];
export {};
//# sourceMappingURL=variable-capture.service.d.ts.map