import { describe, it, expect } from 'vitest';
import { validateCPF, validateCRM } from './validators';

describe('Validators', () => {
  describe('validateCPF', () => {
    it('returns true for a valid formatted CPF', () => {
      expect(validateCPF('111.222.333-44')).toBe(true);
    });

    it('returns false for an invalid format', () => {
      expect(validateCPF('11122233344')).toBe(false);
      expect(validateCPF('11.22.333-44')).toBe(false);
      expect(validateCPF('111.222.333-444')).toBe(false);
    });
  });

  describe('validateCRM', () => {
    it('returns true for a valid formatted CRM', () => {
      expect(validateCRM('12345-SP')).toBe(true);
      expect(validateCRM('123-RJ')).toBe(true);
    });

    it('returns false for an invalid CRM format', () => {
      expect(validateCRM('12345')).toBe(false);
      expect(validateCRM('123456SP')).toBe(false);
      expect(validateCRM('SP-123')).toBe(false);
      expect(validateCRM('123-sp')).toBe(false);
    });
  });
});
