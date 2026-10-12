import { z } from 'zod';
import {
  decodeSession,
  importDiff,
  MAX_IMPORT_BYTES,
  startReview,
  validatePack,
  type ReviewSession,
} from '@/domains/review';
export async function importReviewFile(file: File): Promise<ReviewSession> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Use a diff or review file smaller than 3 MB.');
  const text = await file.text();
  if (!file.name.toLowerCase().endsWith('.json'))
    return startReview(importDiff(text, file.name.replace(/\.(diff|patch|txt)$/i, '')));
  const raw: unknown = JSON.parse(text);
  const session = z.object({ pack: z.unknown(), state: z.unknown() }).safeParse(raw);
  if (session.success) return decodeSession(raw);
  return startReview(validatePack(raw));
}
export function downloadText(filename: string, text: string, type = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([text], { type })),
    link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
