import { defaultPreferences, preferencesSchema, type Preferences } from '@/domains/preferences';

const KEY = 'tracequest:preferences:v1';
export type StoredPreferences =
  { kind: 'ready'; preferences: Preferences } | { kind: 'invalid'; message: string };

export function loadPreferences(storage?: Pick<Storage, 'getItem'>): StoredPreferences {
  try {
    const saved = (storage ?? localStorage).getItem(KEY);
    return {
      kind: 'ready',
      preferences: saved ? preferencesSchema.parse(JSON.parse(saved)) : defaultPreferences(),
    };
  } catch (error) {
    return {
      kind: 'invalid',
      message: error instanceof Error ? error.message : 'Preferences could not be read.',
    };
  }
}

export function persistPreferences(
  preferences: Preferences,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(KEY, JSON.stringify(preferences));
}
