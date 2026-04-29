export type SubscriptionStatus =
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELLED'
  | 'INCOMPLETE';

export interface PlanDto {
  id: string;
  name: string;
  priceMonthly: number;
  currency: string;
  maxAgents: number;
  maxConversationsPerMonth: number;
  maxMessagesPerMonth: number;
  maxContacts: number;
  maxTeamMembers: number;
  features: string[];
}

export interface SubscriptionDto {
  id: string;
  organizationId: string;
  plan: PlanDto;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date | null;
  cancelAtPeriodEnd: boolean;
  priceUsdAtPurchase: number;
  maxMessagesAtPurchase: number;
  maxConversationsAtPurchase: number;
  conversationsUsed: number;
  messagesUsed: number;
}

export interface UsageSummary {
  conversationsUsed: number;
  conversationsLimit: number;
  messagesUsed: number;
  messagesLimit: number;
  conversationsPercent: number;
  messagesPercent: number;
}
