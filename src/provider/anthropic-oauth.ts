import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV1 } from 'ai';

export function createAnthropicOAuth(accessToken: string) {
  const customFetch: typeof fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('anthropic-beta', 'oauth-2025-04-20');
    headers.delete('x-api-key');
    
    return fetch(input, {
      ...init,
      headers,
    });
  };

  return createAnthropic({
    apiKey: '',
    baseURL: 'https://api.anthropic.com/v1',
    fetch: customFetch,
  });
}

export function createClaudeModel(accessToken: string, model: string = 'claude-3-5-sonnet-20241022'): LanguageModelV1 {
  const provider = createAnthropicOAuth(accessToken);
  return provider(model);
}