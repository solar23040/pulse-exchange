import { v4 as uuidv4 } from 'uuid';

/**
 * Safely generates an RFC4122 v4 UUID across all browsers and runtime contexts.
 * Uses the `uuid` package (`uuidv4()`) with fallback to crypto.getRandomValues
 * and Math.random to prevent runtime crashes (e.g., `crypto.randomUUID is not a function`
 * in non-secure HTTP contexts or unsupported browsers).
 */
export function generateUuid(): string {
  try {
    const id = uuidv4();
    if (id) {
      return id;
    }
  } catch {
    // Fallback if uuid package fails in restricted runtime
  }

  try {
    const cryptoObj =
      (typeof window !== 'undefined' && (window.crypto || (window as unknown as { msCrypto: Crypto }).msCrypto)) ||
      (typeof globalThis !== 'undefined' && globalThis.crypto);

    if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      cryptoObj.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // RFC4122 version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC4122 variant
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  } catch {
    // Fall through to Math.random fallback
  }

  // Pure Math.random fallback (RFC4122 compliant v4 template)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}
