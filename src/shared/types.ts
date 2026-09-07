export interface Language {
  code: string;
  name: string;
  targets: string[];
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
}

export interface Preferences {
  sourceLanguage: string;
  targetLanguage: string;
  expanded: boolean;
  enabledLanguages: string[];
  windowPosition: { x: number; y: number } | null;
  launchAtLogin: boolean;
}
