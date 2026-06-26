import React from 'react';
import { useGameStore } from '../../engine/core/GameStore';
import { engineBus } from '../../engine/core/EventBus';
import type { TextSpeed } from '@t/core';

function Slider({ label, value, min = 0, max = 1, step = 0.05, onChange }: {
  label: string; value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-2">
      <span className="text-white/60 text-sm w-40 flex-shrink-0">{label}</span>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-yellow-500"
      />
      <span className="text-white/40 text-xs w-10 text-right">{Math.round(value * 100)}%</span>
    </div>
  );
}

function Toggle({ label, checked, onChange, description }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; description?: string;
}) {
  return (
    <div className="flex items-start justify-between py-2.5">
      <div>
        <p className="text-white/80 text-sm">{label}</p>
        {description && <p className="text-white/35 text-xs mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full transition-colors flex-shrink-0 relative ml-4 ${
          checked ? 'bg-gold/70' : 'bg-white/15'
        }`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-xs uppercase tracking-widest text-gold/50 mb-3 pb-2 border-b border-gold/10">{title}</h3>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const { settings, updateSettings } = useGameStore();

  const handleVolumeChange = (key: keyof typeof settings, value: number) => {
    updateSettings({ [key]: value });
    engineBus.emit('audio:volume_change', { channel: key.replace('Volume', ''), volume: value });
  };

  const TEXT_SPEEDS: TextSpeed[] = ['slow', 'normal', 'fast', 'instant'];

  return (
    <div className="flex flex-col h-full bg-void/95">
      <div className="px-6 py-4 border-b border-gold/20">
        <h2 className="font-display text-gold text-xl">Settings</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-xl mx-auto">

          <Section title="Audio">
            <Slider label="Master Volume" value={settings.masterVolume} onChange={(v) => handleVolumeChange('masterVolume', v)} />
            <Slider label="Music Volume" value={settings.musicVolume} onChange={(v) => handleVolumeChange('musicVolume', v)} />
            <Slider label="SFX Volume" value={settings.sfxVolume} onChange={(v) => handleVolumeChange('sfxVolume', v)} />
            <Slider label="Voice Volume" value={settings.voiceVolume} onChange={(v) => handleVolumeChange('voiceVolume', v)} />
            <Slider label="Ambient Volume" value={settings.ambientVolume} onChange={(v) => handleVolumeChange('ambientVolume', v)} />
          </Section>

          <Section title="Text">
            <div className="flex items-center gap-4 py-2">
              <span className="text-white/60 text-sm w-40 flex-shrink-0">Text Speed</span>
              <div className="flex gap-2">
                {TEXT_SPEEDS.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateSettings({ textSpeed: s })}
                    className={`px-3 py-1 rounded text-xs capitalize transition-colors ${
                      settings.textSpeed === s
                        ? 'bg-gold/25 border border-gold/40 text-gold'
                        : 'bg-white/5 border border-white/10 text-white/50 hover:border-white/25'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              label="Skip Read Text"
              checked={settings.skipReadText}
              onChange={(v) => updateSettings({ skipReadText: v })}
              description="Skip scenes you've already seen when holding Ctrl"
            />
            <Toggle
              label="Auto-Save"
              checked={settings.autoSaveEnabled}
              onChange={(v) => updateSettings({ autoSaveEnabled: v })}
            />
          </Section>

          <Section title="Display">
            <Toggle
              label="Show Soul Meter"
              checked={settings.showSoulMeter}
              onChange={(v) => updateSettings({ showSoulMeter: v })}
            />
            <Toggle
              label="Show Relationship Wheel"
              checked={settings.showRelationshipWheel}
              onChange={(v) => updateSettings({ showRelationshipWheel: v })}
            />
            <div className="flex items-center gap-4 py-2">
              <span className="text-white/60 text-sm w-40 flex-shrink-0">Language</span>
              <select
                value={settings.locale}
                onChange={(e) => updateSettings({ locale: e.target.value as typeof settings.locale })}
                className="bg-abyss border border-white/20 rounded px-3 py-1.5 text-sm text-white/80 focus:outline-none focus:border-gold/50"
              >
                <option value="en">English</option>
                <option value="ja">日本語</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="zh">中文</option>
              </select>
            </div>
          </Section>

          <Section title="Accessibility">
            <Toggle
              label="High Contrast"
              checked={settings.highContrast}
              onChange={(v) => updateSettings({ highContrast: v })}
              description="Increase contrast for text and UI elements"
            />
            <Toggle
              label="Large Text"
              checked={settings.largeText}
              onChange={(v) => updateSettings({ largeText: v })}
            />
            <Toggle
              label="Reduced Motion"
              checked={settings.reducedMotion}
              onChange={(v) => updateSettings({ reducedMotion: v })}
              description="Minimize animations and transitions"
            />
            <Toggle
              label="Closed Captions"
              checked={settings.closedCaptions}
              onChange={(v) => updateSettings({ closedCaptions: v })}
            />
            <Toggle
              label="Dyslexia-Friendly Font"
              checked={settings.dyslexicFont}
              onChange={(v) => updateSettings({ dyslexicFont: v })}
            />
            <Toggle
              label="Screen Reader Hints"
              checked={settings.screenReaderHints}
              onChange={(v) => updateSettings({ screenReaderHints: v })}
            />
          </Section>

        </div>
      </div>
    </div>
  );
}
