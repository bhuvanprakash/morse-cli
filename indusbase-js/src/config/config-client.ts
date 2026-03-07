import type { FetchClient } from '../lib/fetch.js';

export interface EvaluateOptions {
  environment: string;
  userId?: string;
  userProperties?: Record<string, string>;
  keys?: string[];
}

export interface EvaluateResult {
  flags: Record<string, boolean | string | number | object>;
  config: Record<string, string | number | boolean | object>;
}

export class ConfigClient {
  constructor(private fetch: FetchClient) {}

  async evaluate(options: EvaluateOptions) {
    return this.fetch.request('/config/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        environment: options.environment,
        user_id: options.userId,
        user_properties: options.userProperties ?? {},
        keys: options.keys,
      }),
    });
  }

  async getFlag<T extends boolean | string | number>(
    key: string,
    environment: string,
    defaultValue: T,
    userId?: string,
  ): Promise<T> {
    const evalOptions: EvaluateOptions = { environment, keys: [key] };
    if (userId) {
      evalOptions.userId = userId;
    }
    const result = await this.evaluate(evalOptions);
    const payload = result.data as EvaluateResult;
    const val = payload?.flags?.[key];
    return (val !== undefined ? val : defaultValue) as T;
  }
}
