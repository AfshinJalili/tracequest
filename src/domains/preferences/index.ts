import { z } from 'zod';

export const preferencesSchema = z.object({
  keyboardShortcuts: z.boolean().default(true),
});
export type Preferences = z.infer<typeof preferencesSchema>;

export function defaultPreferences(): Preferences {
  return preferencesSchema.parse({});
}
