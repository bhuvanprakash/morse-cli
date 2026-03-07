export interface SendPushOptions {
  userId?: string;
  tokens?: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
}

export interface SendSMSOptions {
  to: string;
  body?: string;
  templateId?: string;
  variables?: Record<string, string>;
  dltTemplateId: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  body: string;
  isHtml?: boolean;
  templateId?: string;
  variables?: Record<string, string>;
}

export interface NotifyResponse {
  sent?: number;
  failed?: number;
  messageId?: string;
  provider?: string;
}
