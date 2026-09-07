import { EventEmitter } from 'events';
import type { Language, TranslationResult } from '../shared/types';

const BASE_URL = 'http://localhost:5000';

class TranslationService extends EventEmitter {
  private languageCache: Language[] | null = null;
  private connected = false;
  private healthInterval: ReturnType<typeof setInterval> | null = null;

  async translate(text: string, source: string, target: string): Promise<TranslationResult> {
    const resp = await this.request('/translate', {
      method: 'POST',
      body: JSON.stringify({ q: text, source, target, format: 'text' }),
    });
    const data = await resp.json();
    return {
      translatedText: data.translatedText,
      detectedLanguage: data.detectedLanguage?.language,
    };
  }

  async detectLanguage(text: string): Promise<string> {
    const resp = await this.request('/detect', {
      method: 'POST',
      body: JSON.stringify({ q: text }),
    });
    const data = await resp.json();
    return data[0]?.language ?? 'en';
  }

  async getLanguages(): Promise<Language[]> {
    if (this.languageCache) return this.languageCache;
    const resp = await this.request('/languages');
    this.languageCache = await resp.json();
    return this.languageCache!;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const resp = await fetch(`${BASE_URL}/languages`, { signal: controller.signal });
      clearTimeout(timeout);
      return resp.ok;
    } catch {
      return false;
    }
  }

  startHealthPolling(intervalMs = 10000): void {
    this.checkAndEmit();
    this.healthInterval = setInterval(() => this.checkAndEmit(), intervalMs);
  }

  stopHealthPolling(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async checkAndEmit(): Promise<void> {
    const status = await this.healthCheck();
    if (status !== this.connected) {
      this.connected = status;
      this.emit('status-change', status);
    }
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    try {
      const resp = await fetch(`${BASE_URL}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
      });
      if (!resp.ok) {
        throw new Error(`LibreTranslate returned ${resp.status}`);
      }
      return resp;
    } catch (err: any) {
      if (err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('ECONNREFUSED')) {
        throw new Error('LibreTranslate is not running. Start it with: libretranslate');
      }
      throw err;
    }
  }
}

export const translationService = new TranslationService();
