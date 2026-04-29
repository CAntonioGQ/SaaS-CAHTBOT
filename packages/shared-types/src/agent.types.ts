export type AgentStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type AgentTone = 'FORMAL' | 'FRIENDLY' | 'PROFESSIONAL' | 'CASUAL';

export interface BusinessHourSlot {
  enabled: boolean;
  open: string;  // "09:00"
  close: string; // "18:00"
}

export interface BusinessHours {
  mon?: BusinessHourSlot;
  tue?: BusinessHourSlot;
  wed?: BusinessHourSlot;
  thu?: BusinessHourSlot;
  fri?: BusinessHourSlot;
  sat?: BusinessHourSlot;
  sun?: BusinessHourSlot;
}

export interface AgentConfig {
  id: string;
  organizationId: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  status: AgentStatus;
  tone: AgentTone;
  modelName: string;
  fallbackModelName: string;
  systemPrompt: string;
  welcomeMessage: string;
  fallbackMessage: string;
  outsideHoursMessage: string;
  temperature: number;
  maxTokens: number;
  contextMessages: number;
  leadCaptureEnabled: boolean;
  appointmentEnabled: boolean;
  inventoryEnabled: boolean;
  humanEscalationEnabled: boolean;
  businessHours: BusinessHours;
  escalationKeywords: string[];
  escalationEmail?: string | null;
  responseDelayMs: number;
  createdAt: Date;
  updatedAt: Date;
}
