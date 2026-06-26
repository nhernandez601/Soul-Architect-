/**
 * LocalizationSystem — runtime i18n with namespace support.
 *
 * Keys are dot-separated (e.g. "ui.menu.new_game").
 * Falls back to 'en' if the requested locale doesn't have a key.
 * Hot-reloadable at runtime; locale change triggers a UI re-render.
 */

import { BaseService } from '../engine/core/BaseService';
import type { Locale } from '@t/core';

interface TranslationMap { [key: string]: string | TranslationMap }

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ja', 'es', 'fr', 'de', 'zh'];

export class LocalizationSystem extends BaseService {
  private locale: Locale = 'en';
  private readonly translations = new Map<Locale, TranslationMap>();

  protected async onInit(): Promise<void> {
    await this.loadLocale('en');
  }

  protected async onStart(): Promise<void> { /* nothing */ }
  protected onDestroy(): void { this.translations.clear(); }

  // ---------------------------------------------------------------------------
  // Locale loading
  // ---------------------------------------------------------------------------

  async loadLocale(locale: Locale): Promise<void> {
    if (this.translations.has(locale)) return;

    try {
      const [uiResponse, storyResponse] = await Promise.all([
        fetch(`/localization/${locale}/ui.json`),
        fetch(`/localization/${locale}/story.json`),
      ]);

      const ui = uiResponse.ok ? await uiResponse.json() as TranslationMap : {};
      const story = storyResponse.ok ? await storyResponse.json() as TranslationMap : {};

      this.translations.set(locale, { ui, story });
      this.log(`Loaded locale: ${locale}`);
    } catch (e) {
      this.warn(`Failed to load locale "${locale}": ${String(e)}`);
      this.translations.set(locale, {});
    }
  }

  async setLocale(locale: Locale): Promise<void> {
    if (!SUPPORTED_LOCALES.includes(locale)) {
      this.warn(`Unsupported locale: "${locale}"`);
      return;
    }
    await this.loadLocale(locale);
    this.locale = locale;
    this.log(`Locale set to: ${locale}`);
    this.bus.emit('ui:notification', { message: `Language changed`, type: 'info' });
  }

  // ---------------------------------------------------------------------------
  // Translation
  // ---------------------------------------------------------------------------

  t(key: string, vars?: Record<string, string | number>): string {
    const result = this.resolve(key, this.locale)
      ?? this.resolve(key, 'en')
      ?? key;

    if (!vars) return result;

    // Variable substitution: {{varName}}
    return result.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
      return String(vars[name] ?? `{{${name}}}`);
    });
  }

  /** Returns true if key exists in current locale. */
  has(key: string): boolean {
    return this.resolve(key, this.locale) !== undefined;
  }

  private resolve(key: string, locale: Locale): string | undefined {
    const map = this.translations.get(locale);
    if (!map) return undefined;

    const parts = key.split('.');
    let current: TranslationMap | string = map;

    for (const part of parts) {
      if (typeof current !== 'object') return undefined;
      const next = current[part];
      if (next === undefined) return undefined;
      current = next as TranslationMap | string;
    }

    return typeof current === 'string' ? current : undefined;
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  getLocale(): Locale { return this.locale; }

  getSupportedLocales(): Array<{ code: Locale; label: string }> {
    return [
      { code: 'en', label: 'English' },
      { code: 'ja', label: '日本語' },
      { code: 'es', label: 'Español' },
      { code: 'fr', label: 'Français' },
      { code: 'de', label: 'Deutsch' },
      { code: 'zh', label: '中文' },
    ];
  }
}

/** Singleton instance for use outside React components. */
export const i18n = new LocalizationSystem('i18n');

/** React-friendly shorthand. Import this in components. */
export function t(key: string, vars?: Record<string, string | number>): string {
  return i18n.t(key, vars);
}
