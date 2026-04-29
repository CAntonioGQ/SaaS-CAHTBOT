export type ConversationStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_HUMAN'
  | 'HUMAN_ACTIVE'
  | 'RESOLVED'
  | 'CLOSED';

export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageType =
  | 'TEXT'
  | 'IMAGE'
  | 'AUDIO'
  | 'VIDEO'
  | 'DOCUMENT'
  | 'TEMPLATE'
  | 'INTERACTIVE'
  | 'SYSTEM';
export type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface ConversationSummary {
  id: string;
  organizationId: string;
  agentId: string;
  contactId: string;
  assignedMemberId?: string | null;
  status: ConversationStatus;
  channelType: string;
  subject?: string | null;
  tags: string[];
  firstMessageAt?: Date | null;
  lastMessageAt?: Date | null;
  messageCount: number;
  unreadCount: number;
  contact: {
    id: string;
    name?: string | null;
    whatsappPhone: string;
    avatarUrl?: string | null;
  };
  agent: {
    id: string;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  direction: MessageDirection;
  type: MessageType;
  status: MessageStatus;
  content: string;
  mediaUrl?: string | null;
  mediaCaption?: string | null;
  isAiGenerated: boolean;
  modelUsed?: string | null;
  toolCallName?: string | null;
  sentByMemberId?: string | null;
  whatsappTimestamp?: Date | null;
  createdAt: Date;
}

// Payload sent over SSE to the frontend inbox
export interface InboxSseEvent {
  type: 'new_message' | 'conversation_updated' | 'conversation_assigned';
  conversationId: string;
  organizationId: string;
  payload: MessageDto | ConversationSummary;
}
