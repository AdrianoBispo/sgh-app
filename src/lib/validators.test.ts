import { describe, it, expect } from 'vitest';
import {
  formatCPF,
  formatPhone,
  isCPFFormat,
  onlyDigits,
  validateBirthDate,
  validateCPF,
  validateCRM,
  validatePhone,
} from './validators';

describe('validateCPF', () => {
  it('aceita CPFs com dígitos verificadores corretos', () => {
    expect(validateCPF('529.982.247-25')).toBe(true);
    expect(validateCPF('111.444.777-35')).toBe(true);
    expect(validateCPF('390.533.447-05')).toBe(true);
  });

  it('rejeita CPFs com máscara correta mas dígitos verificadores inválidos', () => {
    // Regressão: a validação anterior olhava só a máscara e aceitava este valor.
    expect(validateCPF('111.222.333-44')).toBe(false);
    expect(validateCPF('529.982.247-26')).toBe(false);
  });

  it('rejeita sequências repetidas', () => {
    expect(validateCPF('111.111.111-11')).toBe(false);
    expect(validateCPF('000.000.000-00')).toBe(false);
  });

  it('rejeita formatos inválidos', () => {
    expect(validateCPF('52998224725')).toBe(false);
    expect(validateCPF('52.998.224-72')).toBe(false);
    expect(validateCPF('529.982.247-255')).toBe(false);
    expect(validateCPF('')).toBe(false);
  });
});

describe('isCPFFormat', () => {
  it('verifica apenas a máscara', () => {
    expect(isCPFFormat('111.222.333-44')).toBe(true);
    expect(isCPFFormat('11122233344')).toBe(false);
  });
});

describe('validateCRM', () => {
  it('aceita número seguido de UF existente', () => {
    expect(validateCRM('12345-SP')).toBe(true);
    expect(validateCRM('123-RJ')).toBe(true);
  });

  it('rejeita formatos inválidos ou UF inexistente', () => {
    expect(validateCRM('12345')).toBe(false);
    expect(validateCRM('123456SP')).toBe(false);
    expect(validateCRM('SP-123')).toBe(false);
    expect(validateCRM('123-sp')).toBe(false);
    expect(validateCRM('12345-XX')).toBe(false);
  });
});

describe('máscaras', () => {
  it('formata o CPF progressivamente', () => {
    expect(formatCPF('529')).toBe('529');
    expect(formatCPF('529982')).toBe('529.982');
    expect(formatCPF('52998224725')).toBe('529.982.247-25');
    expect(formatCPF('529.982.247-25999')).toBe('529.982.247-25');
  });

  it('formata telefones fixos e celulares', () => {
    expect(formatPhone('1133224455')).toBe('(11) 3322-4455');
    expect(formatPhone('11988887777')).toBe('(11) 98888-7777');
  });

  it('extrai apenas dígitos', () => {
    expect(onlyDigits('(11) 98888-7777')).toBe('11988887777');
  });
});

describe('validatePhone', () => {
  it('aceita 10 ou 11 dígitos', () => {
    expect(validatePhone('(11) 3322-4455')).toBe(true);
    expect(validatePhone('(11) 98888-7777')).toBe(true);
    expect(validatePhone('1199')).toBe(false);
  });
});

describe('validateBirthDate', () => {
  const today = new Date(2026, 0, 15);

  it('aceita datas passadas plausíveis', () => {
    expect(validateBirthDate('1985-04-12', today)).toBe(true);
  });

  it('rejeita datas futuras e formatos inválidos', () => {
    expect(validateBirthDate('2030-01-01', today)).toBe(false);
    expect(validateBirthDate('12/04/1985', today)).toBe(false);
    expect(validateBirthDate('', today)).toBe(false);
  });

  it('rejeita idades acima de 130 anos', () => {
    expect(validateBirthDate('1850-01-01', today)).toBe(false);
  });
});
