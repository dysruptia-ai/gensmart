interface ToolConfig {
    endpointUrl: string;
    httpMethod?: string;
    headers?: Record<string, string>;
    auth?: {
        type?: 'bearer' | 'api_key' | 'none';
        token?: string;
        headerName?: string;
        apiKey?: string;
        queryParam?: string;
    };
    bodyTemplate?: Record<string, unknown>;
    responseMapping?: {
        path?: string;
        displayFormat?: string;
    };
    timeoutMs?: number;
}
export declare function executeCustomFunction(config: ToolConfig, toolArguments: Record<string, unknown>): Promise<string>;
export {};
//# sourceMappingURL=custom-function.service.d.ts.map