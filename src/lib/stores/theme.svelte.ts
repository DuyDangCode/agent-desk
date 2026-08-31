import type { ThemePreference, ResolvedTheme } from '$lib/types';

const THEME_STORAGE_KEY = 'agentdeck_theme_preference';

export const LIGHT_CSS_VARS: Record<string, string> = {
  '--deck-bg': '255 255 255',
  '--deck-surface': '248 250 252',
  '--deck-card': '241 245 249',
  '--deck-border': '226 232 240',
  '--deck-muted': '100 116 139',
  '--deck-text': '30 41 59',
  '--deck-bright': '15 23 42',
  '--deck-accent': '9 105 218',
  '--deck-accent-hover': '5 80 174',
  '--deck-success': '22 163 74',
  '--deck-danger': '225 29 72',
  '--deck-warning': '217 119 6',
};

export const DARK_CSS_VARS: Record<string, string> = {
  '--deck-bg': '13 17 23',
  '--deck-surface': '22 27 34',
  '--deck-card': '33 38 45',
  '--deck-border': '48 54 61',
  '--deck-muted': '139 148 158',
  '--deck-text': '201 209 217',
  '--deck-bright': '240 246 252',
  '--deck-accent': '88 166 255',
  '--deck-accent-hover': '121 192 255',
  '--deck-success': '63 185 80',
  '--deck-danger': '248 81 73',
  '--deck-warning': '210 153 34',
};

export const ONEDARK_CSS_VARS: Record<string, string> = {
  '--deck-bg': '40 44 52',
  '--deck-surface': '33 37 43',
  '--deck-card': '44 49 58',
  '--deck-border': '54 60 72',
  '--deck-muted': '157 165 180',
  '--deck-text': '171 178 191',
  '--deck-bright': '229 231 235',
  '--deck-accent': '97 175 239',
  '--deck-accent-hover': '82 139 210',
  '--deck-success': '152 195 121',
  '--deck-danger': '224 108 117',
  '--deck-warning': '229 192 123',
};

export const DRACULA_CSS_VARS: Record<string, string> = {
  '--deck-bg': '40 42 54',
  '--deck-surface': '33 34 44',
  '--deck-card': '50 53 68',
  '--deck-border': '55 58 75',
  '--deck-muted': '142 154 186',
  '--deck-text': '248 248 242',
  '--deck-bright': '255 255 255',
  '--deck-accent': '189 147 249',
  '--deck-accent-hover': '255 121 198',
  '--deck-success': '80 250 123',
  '--deck-danger': '255 85 85',
  '--deck-warning': '241 250 140',
};

export const NORD_CSS_VARS: Record<string, string> = {
  '--deck-bg': '46 52 64',
  '--deck-surface': '41 46 57',
  '--deck-card': '53 60 74',
  '--deck-border': '62 71 88',
  '--deck-muted': '143 154 175',
  '--deck-text': '216 222 233',
  '--deck-bright': '236 239 244',
  '--deck-accent': '136 192 208',
  '--deck-accent-hover': '129 161 193',
  '--deck-success': '163 190 140',
  '--deck-danger': '191 97 106',
  '--deck-warning': '235 203 139',
};

class ThemeState {
  mode = $state<ThemePreference>('system');
  resolved = $state<ResolvedTheme>('dark');
  systemPrefersDark = $state<boolean>(false);
  private mediaQuery: MediaQueryList | null = null;
  private mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  init() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemPrefersDark = this.mediaQuery.matches;

      this.mediaListener = (e: MediaQueryListEvent) => {
        this.systemPrefersDark = e.matches;
        if (this.mode === 'system') {
          this.applyTheme();
        }
      };

      try {
        this.mediaQuery.addEventListener('change', this.mediaListener);
      } catch {
        this.mediaQuery.addListener(this.mediaListener);
      }
    }

    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
      if (stored) {
        this.mode = stored;
      } else {
        this.mode = 'system';
      }
    } catch {
      this.mode = 'system';
    }

    this.applyTheme();
  }

  setMode(newMode: ThemePreference) {
    this.mode = newMode;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (e) {
      console.warn('Failed to persist theme preference:', e);
    }
    this.applyTheme();
  }

  cycleTheme() {
    const cycleOrder: ThemePreference[] = ['system', 'black', 'white', 'onedark', 'dracula', 'nord'];
    const currentIdx = cycleOrder.indexOf(this.mode);
    const nextIdx = (currentIdx + 1) % cycleOrder.length;
    this.setMode(cycleOrder[nextIdx]);
  }

  private applyTheme() {
    if (this.mode === 'system') {
      this.resolved = this.systemPrefersDark ? 'dark' : 'light';
    } else if (this.mode === 'black' || this.mode === 'dark' || this.mode === 'github-dark') {
      this.resolved = 'dark';
    } else if (this.mode === 'white' || this.mode === 'light') {
      this.resolved = 'light';
    } else if (this.mode === 'onedark') {
      this.resolved = 'onedark';
    } else if (this.mode === 'dracula') {
      this.resolved = 'dracula';
    } else if (this.mode === 'nord') {
      this.resolved = 'nord';
    } else {
      this.resolved = 'dark';
    }

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const body = document.body;
      
      let vars = DARK_CSS_VARS;
      if (this.resolved === 'light') vars = LIGHT_CSS_VARS;
      else if (this.resolved === 'onedark') vars = ONEDARK_CSS_VARS;
      else if (this.resolved === 'dracula') vars = DRACULA_CSS_VARS;
      else if (this.resolved === 'nord') vars = NORD_CSS_VARS;

      for (const [key, value] of Object.entries(vars)) {
        root.style.setProperty(key, value);
      }

      const isLight = this.resolved === 'light';
      if (!isLight) {
        root.classList.add('dark');
        root.classList.remove('light');
        root.setAttribute('data-theme', this.resolved);
        if (body) {
          body.classList.add('dark');
          body.classList.remove('light');
          body.setAttribute('data-theme', this.resolved);
        }
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        root.setAttribute('data-theme', 'light');
        if (body) {
          body.classList.remove('dark');
          body.classList.add('light');
          body.setAttribute('data-theme', 'light');
        }
      }
      root.style.colorScheme = isLight ? 'light' : 'dark';
    }
  }
}

export const themeState = new ThemeState();
