export declare const MEDIA_LIMITS: {
    readonly image: {
        readonly maxSizeBytes: number;
        readonly allowedMimeTypes: readonly ["image/jpeg", "image/png"];
    };
    readonly video: {
        readonly maxSizeBytes: number;
        readonly allowedMimeTypes: readonly ["video/mp4", "video/3gpp"];
    };
    readonly document: {
        readonly maxSizeBytes: number;
        readonly allowedMimeTypes: readonly ["application/pdf", "application/vnd.ms-powerpoint", "application/msword", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/plain"];
    };
    readonly audio: {
        readonly maxSizeBytes: number;
        readonly allowedMimeTypes: readonly ["audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg"];
    };
};
export declare const MEDIA_VALIDATION_CACHE_TTL = 3600;
export declare const MEDIA_VALIDATION_HEAD_TIMEOUT_MS = 8000;
export declare const BLOCKED_HOST_PATTERNS: RegExp[];
export interface MediaValidationResult {
    valid: boolean;
    mimeType?: string;
    sizeBytes?: number;
    error?: string;
    errorCode?: 'INVALID_URL' | 'SSRF_BLOCKED' | 'NOT_HTTPS' | 'HEAD_FAILED' | 'WRONG_TYPE' | 'TOO_LARGE' | 'TIMEOUT';
}
export type MediaType = 'image' | 'video' | 'document' | 'audio';
export declare function isHostBlocked(hostname: string): boolean;
/**
 * Inspect the leading bytes of a buffer and return the detected image MIME type.
 * Only PNG and JPEG are recognized — the two formats WhatsApp accepts for images.
 */
export declare function detectImageMimeFromBytes(bytes: Buffer): string | null;
export declare function validateMediaUrl(url: string, type: MediaType): Promise<MediaValidationResult>;
//# sourceMappingURL=media-validator.service.d.ts.map