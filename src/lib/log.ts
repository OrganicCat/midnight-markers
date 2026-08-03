import { ext } from './ext';

const TAG = '[mm]';

export const log = {
  debug: (...args: unknown[]) => console.debug(TAG, ...args),
  info: (...args: unknown[]) => console.log(TAG, ...args),
  warn: (...args: unknown[]) => console.warn(TAG, ...args),
  error: (...args: unknown[]) => console.error(TAG, ...args),
};

const LAST_AI_ERROR_KEY = 'mm.lastAIError';

export type LastAIError = {
  ts: number;
  message: string;
  status?: number;
  body?: string;
  model?: string;
  url?: string;
};

export async function recordAIError(err: LastAIError): Promise<void> {
  try {
    if (!ext?.storage?.local) return;
    await ext.storage.local.set({ [LAST_AI_ERROR_KEY]: err });
  } catch {
    // best effort
  }
}

export async function getLastAIError(): Promise<LastAIError | null> {
  try {
    if (!ext?.storage?.local) return null;
    const r = await ext.storage.local.get(LAST_AI_ERROR_KEY);
    return (r[LAST_AI_ERROR_KEY] as LastAIError | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function clearLastAIError(): Promise<void> {
  try {
    if (!ext?.storage?.local) return;
    await ext.storage.local.remove(LAST_AI_ERROR_KEY);
  } catch {
    // best effort
  }
}
