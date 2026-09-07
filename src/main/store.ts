import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import type { Preferences } from '../shared/types';

const DEFAULTS: Preferences = {
  sourceLanguage: 'auto',
  targetLanguage: 'de',
  expanded: false,
  enabledLanguages: ['en', 'de'],
  windowPosition: null,
  launchAtLogin: true,
};

let storePath: string;
let cache: Preferences;

export function initStore(): void {
  storePath = join(app.getPath('userData'), 'preferences.json');
  cache = load();
}

function load(): Preferences {
  if (!existsSync(storePath)) return { ...DEFAULTS };
  try {
    const data = JSON.parse(readFileSync(storePath, 'utf-8'));
    return { ...DEFAULTS, ...data };
  } catch {
    return { ...DEFAULTS };
  }
}

function save(): void {
  mkdirSync(dirname(storePath), { recursive: true });
  writeFileSync(storePath, JSON.stringify(cache, null, 2));
}

export function get<K extends keyof Preferences>(key: K): Preferences[K] {
  return cache[key];
}

export function set<K extends keyof Preferences>(key: K, value: Preferences[K]): void {
  cache[key] = value;
  save();
}

export function getAll(): Preferences {
  return { ...cache };
}
