"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTextMessage = sendTextMessage;
exports.markAsRead = markAsRead;
exports.verifyWebhookSignature = verifyWebhookSignature;
exports.getPhoneNumberInfo = getPhoneNumberInfo;
exports.getWABAAndPhoneNumber = getWABAAndPhoneNumber;
exports.downloadMedia = downloadMedia;
exports.downloadAudio = downloadAudio;
exports.transcribeAudio = transcribeAudio;
exports.resolveAccessToken = resolveAccessToken;
exports.sendImageMessage = sendImageMessage;
exports.sendDocumentMessage = sendDocumentMessage;
exports.sendVideoMessage = sendVideoMessage;
exports.encryptAccessToken = encryptAccessToken;
exports.decryptAccessToken = decryptAccessToken;
const crypto_1 = __importDefault(require("crypto"));
const encryption_1 = require("../config/encryption");
const META_API_VERSION = 'v21.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
async function sendTextMessage(phoneNumberId, accessToken, to, text) {
    // Meta Cloud API requires phone numbers in format: +1234567890
    const normalizedTo = to.startsWith('+') ? to : `+${to}`;
    const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: normalizedTo,
            type: 'text',
            text: { body: text },
        }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`WhatsApp API error: ${JSON.stringify(errorData)}`);
    }
}
async function markAsRead(phoneNumberId, accessToken, messageId) {
    const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
    await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read',
            message_id: messageId,
        }),
    }).catch(() => {
        // Non-critical — mark as read failures don't affect message delivery
    });
}
function verifyWebhookSignature(payload, signature, appSecret) {
    const expectedSignature = crypto_1.default
        .createHmac('sha256', appSecret)
        .update(payload)
        .digest('hex');
    const signatureValue = signature.replace('sha256=', '');
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(expectedSignature, 'hex'), Buffer.from(signatureValue, 'hex'));
    }
    catch {
        return false;
    }
}
async function getPhoneNumberInfo(phoneNumberId, accessToken) {
    const url = `${META_BASE_URL}/${phoneNumberId}?fields=display_phone_number,verified_name`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        throw new Error(`Failed to get phone number info: ${response.status}`);
    }
    return response.json();
}
async function getWABAAndPhoneNumber(accessToken) {
    // Step 1: get WABA accounts linked to this user token
    const wabaRes = await fetch(`${META_BASE_URL}/me/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!wabaRes.ok) {
        const err = await wabaRes.json().catch(() => ({}));
        throw new Error(`Failed to fetch WABA accounts: ${JSON.stringify(err)}`);
    }
    const wabaData = await wabaRes.json();
    const waba = wabaData.data?.[0];
    if (!waba)
        throw new Error('No WhatsApp Business Account found for this user');
    const phoneEntry = waba.phone_numbers?.data?.[0];
    if (!phoneEntry) {
        // Fallback: list phone numbers directly from WABA
        const pnRes = await fetch(`${META_BASE_URL}/${waba.id}/phone_numbers?fields=id,display_phone_number`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (pnRes.ok) {
            const pnData = await pnRes.json();
            const pn = pnData.data?.[0];
            if (pn) {
                return { wabaId: waba.id, phoneNumberId: pn.id, displayPhone: pn.display_phone_number };
            }
        }
        throw new Error('No phone number found in WhatsApp Business Account');
    }
    return {
        wabaId: waba.id,
        phoneNumberId: phoneEntry.id,
        displayPhone: phoneEntry.display_phone_number,
    };
}
/**
 * Download media from WhatsApp via Meta Media API.
 * Step 1: GET media URL from media ID
 * Step 2: GET binary content from the temporary URL
 */
async function downloadMedia(mediaId, accessToken) {
    // Step 1: Get the media URL
    const metaUrl = `${META_BASE_URL}/${mediaId}`;
    const metaRes = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({}));
        throw new Error(`Failed to get media URL: ${JSON.stringify(err)}`);
    }
    const metaData = await metaRes.json();
    if (!metaData.url) {
        throw new Error('No URL returned for media');
    }
    const mimeType = metaData.mime_type ?? 'image/jpeg';
    // Only allow image types
    if (!mimeType.startsWith('image/')) {
        throw new Error(`Unsupported media type: ${mimeType}. Only images are supported.`);
    }
    // Reject files > 5MB
    const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
    if (metaData.file_size && metaData.file_size > MAX_IMAGE_SIZE) {
        throw new Error(`Image too large (${Math.round(metaData.file_size / 1024 / 1024)}MB). Max 5MB.`);
    }
    // Step 2: Download the binary data from the temporary URL
    const dataRes = await fetch(metaData.url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!dataRes.ok) {
        throw new Error(`Failed to download media: ${dataRes.status}`);
    }
    const arrayBuffer = await dataRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > MAX_IMAGE_SIZE) {
        throw new Error(`Downloaded image too large (${Math.round(buffer.length / 1024 / 1024)}MB). Max 5MB.`);
    }
    const data = buffer.toString('base64');
    return { data, mimeType };
}
/**
 * Download audio from WhatsApp via Meta Media API.
 * Same 2-step process as downloadMedia, but for audio files.
 */
async function downloadAudio(mediaId, accessToken) {
    const metaUrl = `${META_BASE_URL}/${mediaId}`;
    const metaRes = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) {
        const err = await metaRes.json().catch(() => ({}));
        throw new Error(`Failed to get audio media URL: ${JSON.stringify(err)}`);
    }
    const metaData = await metaRes.json();
    if (!metaData.url) {
        throw new Error('No URL returned for audio media');
    }
    const mimeType = metaData.mime_type ?? 'audio/ogg';
    if (!mimeType.startsWith('audio/')) {
        throw new Error(`Expected audio media type, got: ${mimeType}`);
    }
    // Whisper API limit: 25MB
    const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
    if (metaData.file_size && metaData.file_size > MAX_AUDIO_SIZE) {
        throw new Error(`Audio too large (${Math.round(metaData.file_size / 1024 / 1024)}MB). Max 25MB.`);
    }
    const dataRes = await fetch(metaData.url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!dataRes.ok) {
        throw new Error(`Failed to download audio: ${dataRes.status}`);
    }
    const arrayBuffer = await dataRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length > MAX_AUDIO_SIZE) {
        throw new Error(`Downloaded audio too large (${Math.round(buffer.length / 1024 / 1024)}MB). Max 25MB.`);
    }
    return { buffer, mimeType };
}
/**
 * Transcribe audio using OpenAI Whisper API.
 * Accepts audio buffer directly. Auto-detects language.
 */
async function transcribeAudio(audioBuffer, mimeType) {
    const OpenAI = (await Promise.resolve().then(() => __importStar(require('openai')))).default;
    const client = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] });
    // Map mimeType to file extension for Whisper
    const extMap = {
        'audio/ogg': 'ogg',
        'audio/ogg; codecs=opus': 'ogg',
        'audio/mpeg': 'mp3',
        'audio/mp4': 'm4a',
        'audio/mp4; codecs=opus': 'm4a',
        'audio/wav': 'wav',
        'audio/webm': 'webm',
        'audio/webm;codecs=opus': 'webm',
        'audio/webm; codecs=opus': 'webm',
        'audio/flac': 'flac',
    };
    const baseMime = mimeType.split(';')[0].trim();
    const ext = extMap[mimeType] ?? extMap[baseMime] ?? 'ogg';
    // OpenAI SDK v4+ accepts File objects
    const file = new File([audioBuffer], `audio.${ext}`, { type: baseMime });
    const response = await client.audio.transcriptions.create({
        model: 'whisper-1',
        file,
    });
    return response.text;
}
/**
 * Resolve the WhatsApp access token for an agent.
 * Priority: agent's stored token > platform system user token.
 */
async function resolveAccessToken(waConfig) {
    // 1. Try agent-level token
    if (waConfig?.access_token_encrypted) {
        try {
            return decryptAccessToken(String(waConfig.access_token_encrypted));
        }
        catch {
            console.warn('[whatsapp] Failed to decrypt agent token, falling back to platform token');
        }
    }
    // 2. Fallback to platform-level token
    const { getWhatsAppToken } = await Promise.resolve().then(() => __importStar(require('./platform-settings.service')));
    const platformToken = await getWhatsAppToken();
    if (!platformToken) {
        throw new Error('No WhatsApp access token available (agent or platform)');
    }
    return platformToken;
}
/**
 * Send an image message via WhatsApp Cloud API.
 * Image must be a publicly accessible HTTPS URL.
 * Meta downloads the image from this URL and delivers it to the recipient.
 */
async function sendImageMessage(phoneNumberId, accessToken, to, imageUrl, caption) {
    const normalizedTo = to.startsWith('+') ? to : `+${to}`;
    const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        to: normalizedTo,
        type: 'image',
        image: {
            link: imageUrl,
            ...(caption ? { caption } : {}),
        },
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`WhatsApp send image error: ${JSON.stringify(errorData)}`);
    }
}
/**
 * Send a document (PDF, DOCX, etc.) via WhatsApp Cloud API.
 */
async function sendDocumentMessage(phoneNumberId, accessToken, to, documentUrl, filename, caption) {
    const normalizedTo = to.startsWith('+') ? to : `+${to}`;
    const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        to: normalizedTo,
        type: 'document',
        document: {
            link: documentUrl,
            ...(filename ? { filename } : {}),
            ...(caption ? { caption } : {}),
        },
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`WhatsApp send document error: ${JSON.stringify(errorData)}`);
    }
}
/**
 * Send a video via WhatsApp Cloud API.
 */
async function sendVideoMessage(phoneNumberId, accessToken, to, videoUrl, caption) {
    const normalizedTo = to.startsWith('+') ? to : `+${to}`;
    const url = `${META_BASE_URL}/${phoneNumberId}/messages`;
    const payload = {
        messaging_product: 'whatsapp',
        to: normalizedTo,
        type: 'video',
        video: {
            link: videoUrl,
            ...(caption ? { caption } : {}),
        },
    };
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`WhatsApp send video error: ${JSON.stringify(errorData)}`);
    }
}
function encryptAccessToken(token) {
    return (0, encryption_1.encrypt)(token);
}
function decryptAccessToken(encryptedToken) {
    return (0, encryption_1.decrypt)(encryptedToken);
}
//# sourceMappingURL=whatsapp.service.js.map