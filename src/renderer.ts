import './renderer/styles.css';

declare global {
  interface Window {
    api: {
      translate: (text: string, source: string, target: string) => Promise<any>;
      swapLanguages: () => Promise<{ sourceLanguage: string; targetLanguage: string }>;
      setLanguagePair: (source: string, target: string) => Promise<void>;
      getLanguages: () => Promise<Array<{ code: string; name: string; targets: string[] }>>;
      getPreferences: () => Promise<{
        sourceLanguage: string;
        targetLanguage: string;
        expanded: boolean;
        enabledLanguages: string[];
      }>;
      dismissWindow: () => void;
      setMode: (mode: string) => void;
      setEnabledLanguages: (languages: string[]) => Promise<void>;
      copyTranslation: (text: string) => Promise<void>;
      replaceOriginal: (text: string) => Promise<void>;
      onSourceText: (cb: (text: string) => void) => () => void;
      onTranslationResult: (cb: (result: { translatedText: string; detectedLanguage?: string }) => void) => () => void;
      onTranslationError: (cb: (error: string) => void) => () => void;
      onLanguagesLoaded: (cb: (languages: any[]) => void) => () => void;
      onConnectionStatus: (cb: (connected: boolean) => void) => () => void;
    };
  }
}

interface Language {
  code: string;
  name: string;
  targets: string[];
}

interface AppState {
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  detectedLanguage: string | null;
  allLanguages: Language[];
  enabledLanguages: string[];
  mode: 'compact' | 'expanded' | 'settings';
  loading: boolean;
  error: string | null;
  connected: boolean;
}

const state: AppState = {
  sourceText: '',
  translatedText: '',
  sourceLanguage: 'auto',
  targetLanguage: 'de',
  detectedLanguage: null,
  allLanguages: [],
  enabledLanguages: ['en', 'de'],
  mode: 'compact',
  loading: false,
  error: null,
  connected: false,
};

const $ = (sel: string) => document.querySelector(sel)!;

const sourceLang = $('#source-lang') as HTMLSelectElement;
const targetLang = $('#target-lang') as HTMLSelectElement;
const swapBtn = $('#swap-btn') as HTMLButtonElement;
const expandBtn = $('#expand-btn') as HTMLButtonElement;
const settingsBtn = $('#settings-btn') as HTMLButtonElement;
const closeBtn = $('#close-btn') as HTMLButtonElement;
const compactView = $('#compact-view') as HTMLDivElement;
const translationOutput = $('#translation-output') as HTMLDivElement;
const detectedBadge = $('#detected-badge') as HTMLDivElement;
const expandedView = $('#expanded-view') as HTMLDivElement;
const sourceTextEl = $('#source-text') as HTMLTextAreaElement;
const expandedTranslation = $('#expanded-translation') as HTMLDivElement;
const settingsView = $('#settings-view') as HTMLDivElement;
const languageList = $('#language-list') as HTMLDivElement;
const langCount = $('#lang-count') as HTMLSpanElement;
const settingsDone = $('#settings-done') as HTMLButtonElement;
const actionBar = $('#action-bar') as HTMLDivElement;
const copyBtn = $('#copy-btn') as HTMLButtonElement;
const replaceBtn = $('#replace-btn') as HTMLButtonElement;
const errorDisplay = $('#error-display') as HTMLDivElement;
const loadingEl = $('#loading') as HTMLDivElement;
const statusDot = $('#status-dot') as HTMLDivElement;

let debounceTimer: ReturnType<typeof setTimeout>;
let swapRotated = false;

function enabledLangs(): Language[] {
  return state.allLanguages.filter(l => state.enabledLanguages.includes(l.code));
}

function render(): void {
  loadingEl.classList.toggle('hidden', !state.loading);

  if (state.error) {
    errorDisplay.textContent = state.error;
    errorDisplay.classList.remove('hidden');
  } else {
    errorDisplay.classList.add('hidden');
  }

  translationOutput.textContent = state.translatedText;
  expandedTranslation.textContent = state.translatedText;

  detectedBadge.textContent = state.detectedLanguage
    ? `Detected: ${state.detectedLanguage.toUpperCase()}`
    : '';

  compactView.classList.toggle('hidden', state.mode !== 'compact' || !!state.error);
  expandedView.classList.toggle('hidden', state.mode !== 'expanded');
  settingsView.classList.toggle('hidden', state.mode !== 'settings');

  expandBtn.textContent = state.mode === 'expanded' ? '⬓' : '⬒';

  statusDot.className = state.connected ? 'connected' : '';
  statusDot.title = state.connected ? 'Connected' : 'Disconnected';

  const hasTranslation = state.translatedText && !state.error && state.mode !== 'settings';
  actionBar.classList.toggle('hidden', !hasTranslation);
}

function populateLanguageDropdowns(): void {
  const enabled = enabledLangs();

  sourceLang.innerHTML = '<option value="auto">Auto-detect</option>';
  targetLang.innerHTML = '';

  for (const lang of enabled) {
    const sOpt = document.createElement('option');
    sOpt.value = lang.code;
    sOpt.textContent = lang.name;
    sourceLang.appendChild(sOpt);

    const tOpt = document.createElement('option');
    tOpt.value = lang.code;
    tOpt.textContent = lang.name;
    targetLang.appendChild(tOpt);
  }

  sourceLang.value = state.sourceLanguage;
  targetLang.value = state.targetLanguage;
}

function renderLanguageSettings(): void {
  languageList.innerHTML = '';
  const sorted = [...state.allLanguages].sort((a, b) => a.name.localeCompare(b.name));

  for (const lang of sorted) {
    const item = document.createElement('label');
    item.className = 'lang-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = state.enabledLanguages.includes(lang.code);
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!state.enabledLanguages.includes(lang.code)) {
          state.enabledLanguages.push(lang.code);
        }
      } else {
        state.enabledLanguages = state.enabledLanguages.filter(c => c !== lang.code);
      }
      langCount.textContent = `${state.enabledLanguages.length} selected`;
    });

    const code = document.createElement('span');
    code.className = 'lang-code';
    code.textContent = lang.code;

    const name = document.createElement('span');
    name.textContent = lang.name;

    item.appendChild(cb);
    item.appendChild(code);
    item.appendChild(name);
    languageList.appendChild(item);
  }

  langCount.textContent = `${state.enabledLanguages.length} selected`;
}

async function retranslate(): Promise<void> {
  if (!state.sourceText.trim()) return;
  state.loading = true;
  state.error = null;
  render();

  const result = await window.api.translate(
    state.sourceText,
    state.sourceLanguage,
    state.targetLanguage
  );

  state.loading = false;
  if (result.error) {
    state.error = result.error;
  } else {
    state.translatedText = result.translatedText;
    if (result.detectedLanguage) {
      state.detectedLanguage = result.detectedLanguage;
    }
  }
  render();
}

function setMode(mode: 'compact' | 'expanded' | 'settings'): void {
  state.mode = mode;
  window.api.setMode(mode);
  if (mode === 'expanded') {
    sourceTextEl.value = state.sourceText;
  }
  if (mode === 'settings') {
    renderLanguageSettings();
  }
  render();
}

// Event listeners
swapBtn.addEventListener('click', async () => {
  swapRotated = !swapRotated;
  swapBtn.classList.toggle('rotated', swapRotated);

  const result = await window.api.swapLanguages();
  state.sourceLanguage = result.sourceLanguage;
  state.targetLanguage = result.targetLanguage;
  sourceLang.value = state.sourceLanguage;
  targetLang.value = state.targetLanguage;

  if (state.mode === 'expanded') {
    const oldSource = state.sourceText;
    state.sourceText = state.translatedText;
    sourceTextEl.value = state.sourceText;
    state.translatedText = oldSource;
  }

  retranslate();
});

expandBtn.addEventListener('click', () => {
  setMode(state.mode === 'expanded' ? 'compact' : 'expanded');
});

settingsBtn.addEventListener('click', () => {
  setMode(state.mode === 'settings' ? 'compact' : 'settings');
});

settingsDone.addEventListener('click', async () => {
  await window.api.setEnabledLanguages(state.enabledLanguages);
  populateLanguageDropdowns();
  setMode('compact');
});

closeBtn.addEventListener('click', () => window.api.dismissWindow());

copyBtn.addEventListener('click', async () => {
  await window.api.copyTranslation(state.translatedText);
  copyBtn.textContent = 'Copied';
  copyBtn.classList.add('copied');
  setTimeout(() => {
    copyBtn.textContent = 'Copy';
    copyBtn.classList.remove('copied');
  }, 1500);
});

replaceBtn.addEventListener('click', () => {
  window.api.replaceOriginal(state.translatedText);
});

sourceLang.addEventListener('change', () => {
  state.sourceLanguage = sourceLang.value;
  window.api.setLanguagePair(state.sourceLanguage, state.targetLanguage);
  retranslate();
});

targetLang.addEventListener('change', () => {
  state.targetLanguage = targetLang.value;
  window.api.setLanguagePair(state.sourceLanguage, state.targetLanguage);
  retranslate();
});

sourceTextEl.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  state.sourceText = sourceTextEl.value;
  debounceTimer = setTimeout(() => retranslate(), 400);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (state.mode === 'settings') {
      settingsDone.click();
    } else {
      window.api.dismissWindow();
    }
  }
});

// IPC listeners from main process
window.api.onSourceText((text) => {
  state.sourceText = text;
  state.error = null;
  state.loading = true;
  sourceTextEl.value = text;
  if (state.mode === 'settings') {
    state.mode = 'compact';
    window.api.setMode('compact');
  }
  render();
});

window.api.onTranslationResult((result) => {
  state.loading = false;
  state.error = null;
  state.translatedText = result.translatedText;
  if (result.detectedLanguage) {
    state.detectedLanguage = result.detectedLanguage;
  }
  render();
});

window.api.onTranslationError((error) => {
  state.loading = false;
  state.error = error;
  render();
});

window.api.onLanguagesLoaded((languages) => {
  state.allLanguages = languages;
  populateLanguageDropdowns();
});

window.api.onConnectionStatus((connected) => {
  state.connected = connected;
  render();
});

// Initialize
(async () => {
  const prefs = await window.api.getPreferences();
  state.sourceLanguage = prefs.sourceLanguage;
  state.targetLanguage = prefs.targetLanguage;
  state.enabledLanguages = prefs.enabledLanguages;
  state.mode = prefs.expanded ? 'expanded' : 'compact';

  const languages = await window.api.getLanguages();
  if (languages.length > 0) {
    state.allLanguages = languages;
    populateLanguageDropdowns();
  }

  render();
})();
