import crypto from 'crypto';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
const CONSOLE_BASE_URL = 'https://console.anthropic.com';
const CLAUDE_BASE_URL = 'https://claude.ai';

const TokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_at: z.number(),
  token_type: z.string(),
});

type Token = z.infer<typeof TokenSchema>;

export class AnthropicOAuth {
  private tokenPath: string;
  private codeVerifier?: string;

  constructor() {
    const configDir = path.join(os.homedir(), '.local', 'browser-ai');
    this.tokenPath = path.join(configDir, 'auth.json');
  }

  generatePKCE() {
    this.codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(this.codeVerifier)
      .digest('base64url');
    
    return {
      codeVerifier: this.codeVerifier,
      codeChallenge,
    };
  }

  getAuthorizationUrl(mode: 'max' | 'console' = 'max'): string {
    const { codeChallenge, codeVerifier } = this.generatePKCE();
    
    const baseUrl = mode === 'console' ? CONSOLE_BASE_URL : CLAUDE_BASE_URL;
    const params = new URLSearchParams({
      code: 'true',
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: 'org:create_api_key user:profile user:inference',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state: codeVerifier,
    });

    return `${baseUrl}/oauth/authorize?${params}`;
  }

  async exchangeCodeForToken(codeWithState: string): Promise<Token> {
    if (!this.codeVerifier) {
      throw new Error('No code verifier found. Call getAuthorizationUrl first.');
    }

    const [code, state] = codeWithState.split('#');

    // The state returned should be our code verifier
    // If state is provided and doesn't match, use it as the verifier
    const actualVerifier = state || this.codeVerifier;

    const response = await fetch(`${CONSOLE_BASE_URL}/v1/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        state: actualVerifier,
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code_verifier: actualVerifier,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json() as any;
    const token = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type || 'Bearer',
      expires_at: Date.now() + (data.expires_in * 1000),
    };

    await this.saveToken(token);
    return token;
  }

  async refreshToken(refreshToken: string): Promise<Token> {
    const response = await fetch(`${CONSOLE_BASE_URL}/v1/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: CLIENT_ID,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json() as any;
    const token = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      token_type: data.token_type || 'Bearer',
      expires_at: Date.now() + (data.expires_in * 1000),
    };

    await this.saveToken(token);
    return token;
  }

  private async saveToken(token: Token): Promise<void> {
    const dir = path.dirname(this.tokenPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.tokenPath, JSON.stringify(token, null, 2));
  }

  async loadToken(): Promise<Token | null> {
    try {
      const data = await fs.readFile(this.tokenPath, 'utf-8');
      return TokenSchema.parse(JSON.parse(data));
    } catch {
      return null;
    }
  }

  async getAccessToken(): Promise<string> {
    const token = await this.loadToken();
    if (!token) {
      throw new Error('No token found. Please authenticate first.');
    }

    if (Date.now() >= token.expires_at - 60000) {
      if (token.refresh_token) {
        const newToken = await this.refreshToken(token.refresh_token);
        return newToken.access_token;
      } else {
        throw new Error('Token expired and no refresh token available.');
      }
    }

    return token.access_token;
  }

  async logout(): Promise<void> {
    try {
      await fs.unlink(this.tokenPath);
    } catch {
      // Ignore error if file doesn't exist
    }
  }
}