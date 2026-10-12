import { describe, expect, it } from 'vitest';
import { loadPreferences, persistPreferences } from '@/persistence/preferences-storage';

describe('application preferences', () => {
  it('enables shortcuts when there is no saved preference', () => {
    expect(loadPreferences()).toEqual({ kind: 'ready', preferences: { keyboardShortcuts: true } });
  });
  it('persists a disabled preference separately from review progress', () => {
    persistPreferences({ keyboardShortcuts: false });
    expect(loadPreferences()).toEqual({ kind: 'ready', preferences: { keyboardShortcuts: false } });
  });
  it.each(['not JSON', '{"keyboardShortcuts":"false"}'])(
    'reports an invalid stored preference: %s',
    (saved) => {
      expect(loadPreferences({ getItem: () => saved }).kind).toBe('invalid');
    },
  );
  it('reports storage read failures and lets callers handle write failures', () => {
    const unavailable = () => {
      throw new Error('Storage unavailable');
    };
    expect(loadPreferences({ getItem: unavailable })).toEqual({
      kind: 'invalid',
      message: 'Storage unavailable',
    });
    expect(() =>
      persistPreferences({ keyboardShortcuts: false }, { setItem: unavailable }),
    ).toThrow('Storage unavailable');
  });
});
