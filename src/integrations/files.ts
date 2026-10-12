import { z } from 'zod';
import {
  decodeSession,
  importDiff,
  fileImportLimits,
  startReview,
  validatePack,
  type ReviewSession,
} from '@/domains/review';
export async function importReviewFile(
  file: Pick<File, 'name' | 'size' | 'text'>,
): Promise<ReviewSession> {
  const isReviewFile = file.name.toLowerCase().endsWith('.json');
  const limit = isReviewFile ? fileImportLimits.review : fileImportLimits.diff;
  if (file.size > limit.maxBytes)
    throw new Error(`Use a diff or review file smaller than ${limit.label}.`);
  const text = await file.text();
  if (!isReviewFile)
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
