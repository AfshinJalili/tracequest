import { validatePack, type ReviewPack } from '@/domains/review';
export async function loadDemoPack(signal?: AbortSignal): Promise<ReviewPack> {
  const response = await fetch(`${import.meta.env.BASE_URL}demo.json`, { signal });
  if (!response.ok) throw new Error('Demo request failed (' + response.status + ').');
  const raw: unknown = await response.json();
  return validatePack(raw);
}
