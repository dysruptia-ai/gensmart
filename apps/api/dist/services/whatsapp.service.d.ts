export declare function sendTextMessage(phoneNumberId: string, accessToken: string, to: string, text: string): Promise<void>;
export declare function markAsRead(phoneNumberId: string, accessToken: string, messageId: string): Promise<void>;
export declare function verifyWebhookSignature(payload: string, signature: string, appSecret: string): boolean;
export declare function getPhoneNumberInfo(phoneNumberId: string, accessToken: string): Promise<{
    display_phone_number: string;
    verified_name: string;
}>;
export declare function getWABAAndPhoneNumber(accessToken: string): Promise<{
    wabaId: string;
    phoneNumberId: string;
    displayPhone: string;
}>;
/**
 * Download media from WhatsApp via Meta Media API.
 * Step 1: GET media URL from media ID
 * Step 2: GET binary content from the temporary URL
 */
export declare function downloadMedia(mediaId: string, accessToken: string): Promise<{
    data: string;
    mimeType: string;
}>;
/**
 * Download audio from WhatsApp via Meta Media API.
 * Same 2-step process as downloadMedia, but for audio files.
 */
export declare function downloadAudio(mediaId: string, accessToken: string): Promise<{
    buffer: Buffer;
    mimeType: string;
}>;
/**
 * Transcribe audio using OpenAI Whisper API.
 * Accepts audio buffer directly. Auto-detects language.
 */
export declare function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string>;
/**
 * Resolve the WhatsApp access token for an agent.
 * Priority: agent's stored token > platform system user token.
 */
export declare function resolveAccessToken(waConfig: Record<string, unknown> | null | undefined): Promise<string>;
/**
 * Send an image message via WhatsApp Cloud API.
 * Image must be a publicly accessible HTTPS URL.
 * Meta downloads the image from this URL and delivers it to the recipient.
 */
export declare function sendImageMessage(phoneNumberId: string, accessToken: string, to: string, imageUrl: string, caption?: string): Promise<void>;
/**
 * Send a document (PDF, DOCX, etc.) via WhatsApp Cloud API.
 */
export declare function sendDocumentMessage(phoneNumberId: string, accessToken: string, to: string, documentUrl: string, filename?: string, caption?: string): Promise<void>;
/**
 * Send a video via WhatsApp Cloud API.
 */
export declare function sendVideoMessage(phoneNumberId: string, accessToken: string, to: string, videoUrl: string, caption?: string): Promise<void>;
export declare function encryptAccessToken(token: string): string;
export declare function decryptAccessToken(encryptedToken: string): string;
//# sourceMappingURL=whatsapp.service.d.ts.map