import type { Settings } from '$lib/types';
import { activeKey, activeProvider } from './provider';

/**
 * The single gate every outbound AI request passes through.
 *
 * Chrome Web Store policy requires prominent disclosure and affirmative
 * consent before user data is handled, so consent is checked here rather than
 * inferred from "the user pasted a key". Keep this the only place that decides
 * whether page data may leave the device.
 *
 * The key check is scoped to the *active* provider: an OpenRouter key on file
 * must not open the gate while Anthropic is the selected provider.
 */
export function canUseAI(s: Settings): boolean {
  if (s.aiConsentAt === null) return false;
  if (!activeKey(s)) return false;
  return s.aiFeatures.tags || s.aiFeatures.title || s.aiFeatures.collection;
}

/** Human-readable reason the gate is closed, for UI. Null when it is open. */
export function whyBlocked(s: Settings): string | null {
  if (s.aiConsentAt === null) return 'You have not accepted the data-sharing disclosure yet.';
  if (!activeKey(s)) return `No ${activeProvider(s).label} API key is set.`;
  if (!(s.aiFeatures.tags || s.aiFeatures.title || s.aiFeatures.collection)) {
    return 'All AI features are turned off.';
  }
  return null;
}
