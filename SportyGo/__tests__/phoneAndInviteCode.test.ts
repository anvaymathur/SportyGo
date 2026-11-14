import { formatPhone, phoneDigits, isValidOptionalPhone } from '../utils/phone';
import { parseInviteCode } from '../utils/inviteCode';

describe('phone numbers', () => {
  it('keeps digits only, drops a leading country code, caps at 10', () => {
    expect(phoneDigits('(555) 123-4567')).toBe('5551234567');
    expect(phoneDigits('+1 555 123 4567')).toBe('5551234567');
    expect(phoneDigits('555123456789')).toBe('5551234567');
    expect(phoneDigits(undefined)).toBe('');
  });

  it('formats complete and partial numbers', () => {
    expect(formatPhone('5551234567')).toBe('(555) 123-4567');
    expect(formatPhone('555123')).toBe('(555) 123');
    expect(formatPhone('')).toBe('');
  });

  it('accepts a blank or complete number, rejects a partial one', () => {
    expect(isValidOptionalPhone('')).toBe(true);
    expect(isValidOptionalPhone('5551234567')).toBe(true);
    expect(isValidOptionalPhone('555')).toBe(false);
  });
});

describe('parseInviteCode', () => {
  it('accepts a bare code, keeping its case', () => {
    expect(parseInviteCode('  aB3_x-  ')).toBe('aB3_x-');
  });

  it('takes the code from a pasted invite link', () => {
    expect(parseInviteCode('https://sportygo-sparkpro.web.app/groups/aB3_x-')).toBe('aB3_x-');
    expect(parseInviteCode('https://sportygo-sparkpro.web.app/groups/aB3_x-/?utm=1')).toBe('aB3_x-');
  });

  it('rejects empty or malformed input', () => {
    expect(parseInviteCode('')).toBeNull();
    expect(parseInviteCode('ab')).toBeNull();
    expect(parseInviteCode('has spaces in it')).toBeNull();
    expect(parseInviteCode(undefined)).toBeNull();
  });
});
