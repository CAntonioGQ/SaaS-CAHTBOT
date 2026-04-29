// Meta WhatsApp Cloud API payload types

export interface WhatsAppWebhookBody {
  object: 'whatsapp_business_account';
  entry: WhatsAppEntry[];
}

export interface WhatsAppEntry {
  id: string;
  changes: WhatsAppChange[];
}

export interface WhatsAppChange {
  value: WhatsAppValue;
  field: 'messages';
}

export interface WhatsAppValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WhatsAppContact[];
  messages?: WhatsAppMessage[];
  statuses?: WhatsAppStatus[];
}

export interface WhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

export interface WhatsAppMessage {
  id: string;       // wamid — used for dedup
  from: string;     // sender phone number
  timestamp: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'interactive' | 'sticker';
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; caption?: string };
  document?: { id: string; mime_type: string; filename?: string };
}

export interface WhatsAppStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

// Payload we build to send a message via Cloud API
export interface WhatsAppSendTextPayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: { body: string; preview_url?: boolean };
}

// Normalized inbound message after parsing webhook
export interface ParsedInboundMessage {
  wamid: string;
  fromPhone: string;
  toPhoneNumberId: string;
  contactName?: string;
  type: string;
  text?: string;
  mediaId?: string;
  mediaMimeType?: string;
  mediaCaption?: string;
  timestamp: Date;
}
