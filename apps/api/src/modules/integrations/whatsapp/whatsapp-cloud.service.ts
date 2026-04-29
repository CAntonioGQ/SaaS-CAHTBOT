import { Injectable, Logger } from '@nestjs/common';

const GRAPH_API_VERSION = 'v20.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export interface SendTextResult {
  wamid: string;   // WhatsApp message ID — store this for delivery tracking
}

// Low-level adapter for Meta WhatsApp Cloud API.
// Handles only HTTP communication — no business logic, no DB access.
// All methods receive phoneNumberId + accessToken explicitly so this service
// is stateless and can be used across multiple org contexts.
@Injectable()
export class WhatsAppCloudService {
  private readonly logger = new Logger(WhatsAppCloudService.name);

  async sendText(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    text: string,
  ): Promise<SendTextResult> {
    const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body: text, preview_url: false },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `WhatsApp Cloud API error ${response.status}: ${errorBody}`,
      );
      throw new Error(
        `WhatsApp send failed [${response.status}]: ${errorBody}`,
      );
    }

    const data = await response.json() as {
      messages: Array<{ id: string }>;
    };

    return { wamid: data.messages[0].id };
  }

  // Mark a message as read — shows double blue tick to the user
  async markAsRead(
    phoneNumberId: string,
    accessToken: string,
    wamid: string,
  ): Promise<void> {
    const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;

    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: wamid,
      }),
    });
    // Intentionally ignore errors — marking as read is non-critical
  }

  // Download media file (image, audio, document) by Meta media ID
  async getMediaUrl(mediaId: string, accessToken: string): Promise<string> {
    const url = `${GRAPH_API_BASE}/${mediaId}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to get media URL for ${mediaId}`);
    }

    const data = await response.json() as { url: string };
    return data.url;
  }
}
