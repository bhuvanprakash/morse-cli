import type { FetchClient } from '../lib/fetch.js';
import type {
  SendPushOptions,
  SendSMSOptions,
  SendEmailOptions,
} from './types.js';

export class NotifyClient {
  constructor(private fetch: FetchClient) {}

  async sendPush(options: SendPushOptions) {
    return this.fetch.request('/notify/push', {
      method: 'POST',
      body: JSON.stringify({
        user_id: options.userId,
        tokens: options.tokens,
        title: options.title,
        body: options.body,
        data: options.data,
        badge: options.badge,
        sound: options.sound,
      }),
    });
  }

  async registerDevice(token: string, platform: 'fcm' | 'apns' | 'web', deviceName?: string) {
    return this.fetch.request('/notify/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform, device_name: deviceName }),
    });
  }

  async sendSMS(options: SendSMSOptions) {
    return this.fetch.request('/notify/sms', {
      method: 'POST',
      body: JSON.stringify({
        to: options.to,
        body: options.body,
        template_id: options.templateId,
        variables: options.variables,
        dlt_template_id: options.dltTemplateId,
      }),
    });
  }

  async sendEmail(options: SendEmailOptions) {
    const to = Array.isArray(options.to) ? options.to : [options.to];
    return this.fetch.request('/notify/email', {
      method: 'POST',
      body: JSON.stringify({
        to,
        subject: options.subject,
        body: options.body,
        is_html: options.isHtml,
        template_id: options.templateId,
        variables: options.variables,
      }),
    });
  }
}
