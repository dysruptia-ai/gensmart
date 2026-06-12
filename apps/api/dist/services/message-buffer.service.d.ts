export interface BufferItem {
    type: 'text' | 'image';
    content: string;
    mimeType?: string;
    data?: string;
}
export declare function pushToBuffer(conversationId: string, agentId: string, organizationId: string, message: string | BufferItem, bufferSeconds: number): Promise<void>;
export declare function flushBuffer(conversationId: string): Promise<BufferItem[]>;
//# sourceMappingURL=message-buffer.service.d.ts.map