import { describe, it, expect } from 'vitest';
import { ageFromBirthDate, dateTimeValue, daysUntil, formatDateBR, parseISODate, toISODate, todayISO } from './date';

describe('parseISODate', () => {
  it('ancora a data ao meio-dia local, sem deslocar o dia', () => {
    const date = parseISODate('2024-05-10');
    expect(date?.getFullYear()).toBe(2024);
    expect(date?.getMonth()).toBe(4);
    expect(date?.getDate()).toBe(10);
    expect(date?.getHours()).toBe(12);
  });

  it('devolve null para entradas inválidas', () => {
    expect(parseISODate('10/05/2024')).toBeNull();
    expect(parseISODate('')).toBeNull();
    expect(parseISODate('2024-13-45')).not.toBeNull(); // normalizado pelo Date
  });
});

describe('formatDateBR', () => {
  it('formata no padrão brasileiro sem perder um dia', () => {
    // Regressão: `new Date('2024-01-01')` era interpretado como UTC e exibia 31/12.
    expect(formatDateBR('2024-01-01')).toBe('01/01/2024');
    expect(formatDateBR('1985-04-12')).toBe('12/04/1985');
  });

  it('usa o fallback quando a data é inválida', () => {
    expect(formatDateBR('')).toBe('—');
    expect(formatDateBR(undefined, 'n/d')).toBe('n/d');
  });
});

describe('toISODate e todayISO', () => {
  it('converte usando o fuso local', () => {
    expect(toISODate(new Date(2024, 0, 1, 23, 30))).toBe('2024-01-01');
    expect(toISODate(new Date(2024, 11, 31, 22, 0))).toBe('2024-12-31');
  });

  it('todayISO devolve o dia local corrente', () => {
    expect(todayISO()).toBe(toISODate(new Date()));
  });
});

describe('daysUntil', () => {
  const reference = new Date(2026, 0, 15, 10, 0);

  it('calcula dias restantes e vencidos', () => {
    expect(daysUntil('2026-01-15', reference)).toBe(0);
    expect(daysUntil('2026-01-20', reference)).toBe(5);
    expect(daysUntil('2026-01-10', reference)).toBe(-5);
  });
});

describe('ageFromBirthDate', () => {
  const reference = new Date(2026, 0, 15);

  it('conta anos completos', () => {
    expect(ageFromBirthDate('1986-01-15', reference)).toBe(40);
    expect(ageFromBirthDate('1986-01-16', reference)).toBe(39);
  });
});

describe('dateTimeValue', () => {
  it('ordena data + hora corretamente', () => {
    expect(dateTimeValue('2024-05-10', '09:00')).toBeLessThan(dateTimeValue('2024-05-10', '14:30'));
    expect(dateTimeValue('2024-05-09', '23:00')).toBeLessThan(dateTimeValue('2024-05-10', '01:00'));
  });
});
