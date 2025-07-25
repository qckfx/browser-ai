import { AnthropicOAuth } from './anthropic';

export class TokenManager {
  private oauth: AnthropicOAuth;
  private tokenRefreshPromise: Promise<string> | null = null;

  constructor() {
    this.oauth = new AnthropicOAuth();
  }

  async getValidToken(): Promise<string> {
    // If we're already refreshing, wait for that to complete
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    try {
      // First try OAuth token
      return await this.oauth.getAccessToken();
    } catch (error) {
      // Fall back to environment variable
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        return apiKey;
      }
      
      // If neither auth method works, throw error
      throw new Error(`Authentication required: ${error}`);
    }
  }

  async refreshIfNeeded(): Promise<void> {
    try {
      await this.getValidToken();
    } catch {
      // Token is invalid or expired
      console.error('Token refresh failed. Re-authentication required.');
    }
  }

  async saveToken(token: any): Promise<void> {
    // Delegate to OAuth implementation
    await this.oauth.exchangeCodeForToken(token);
  }

  async clearToken(): Promise<void> {
    await this.oauth.logout();
  }

  async isAuthenticated(): Promise<boolean> {
    try {
      await this.getValidToken();
      return true;
    } catch {
      return false;
    }
  }
  
  hasApiKey(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  getAuthUrl(): string {
    return this.oauth.getAuthorizationUrl();
  }
}