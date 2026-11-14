import { AsYouType } from 'libphonenumber-js';

/** Phone numbers are stored as 10 digits (North American numbers, no country code). */
export const PHONE_DIGITS = 10;

/** Strips everything but digits, drops a leading country code 1, and caps the length. */
export function phoneDigits(text: string | undefined | null): string {
  let digits = (text ?? '').replace(/\D/g, '');
  if (digits.length === PHONE_DIGITS + 1 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.slice(0, PHONE_DIGITS);
}

/** "5551234567" -> "(555) 123-4567"; partial numbers are formatted as far as they go. */
export function formatPhone(text: string | undefined | null): string {
  const digits = phoneDigits(text);
  return digits ? new AsYouType('US').input(digits) : '';
}

/** A phone number is optional, but if given it must be complete. */
export function isValidOptionalPhone(text: string | undefined | null): boolean {
  const length = phoneDigits(text).length;
  return length === 0 || length === PHONE_DIGITS;
}
