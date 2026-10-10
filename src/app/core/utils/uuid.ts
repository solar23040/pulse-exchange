import { v4 as uuidv4 } from 'uuid';

/**
 * Safely generates a standard RFC4122 v4 UUID across all browsers and runtime contexts.
 *
 * Uses native `crypto.randomUUID()` when available in secure contexts (HTTPS / localhost),
 * falls back to the `uuid` package (`uuidv4()`), and provides a final Math.random-based fallback
 * for non-secure / restricted environments where native crypto methods are unavailable.
 */
export function generateUuid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // Fall through to uuidv4 fallback if crypto.randomUUID fails
  }

  try {
    return uuidv4();
  } catch {
    // Fallback for environments lacking crypto.getRandomValues
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const rand = (Math.random() * 16) | 0;
      const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
      return value.toString(16);
    });
  }
}
