import { describe, it, expect } from 'vitest';
import { InventoryItem } from '../types';
import { getExpiryState, getStockHealth, getStockLevel, summarizeInventory } from './inventory';

const today = new Date(2026, 2, 10);

const item = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'i1',
  name: 'Paracetamol 500mg',
  batch: 'LOTE-1',
  expiryDate: '2027-01-01',
  quantity: 100,
  minQuantity: 20,
  status: 'active',
  ...overrides,
});

describe('getStockLevel', () => {
  it('classifica saldo zerado, mínimo e regular', () => {
    expect(getStockLevel(item({ quantity: 0 }))).toBe('out');
    expect(getStockLevel(item({ quantity: 20, minQuantity: 20 }))).toBe('low');
    expect(getStockLevel(item({ quantity: 21, minQuantity: 20 }))).toBe('ok');
  });
});

describe('getExpiryState', () => {
  it('identifica lotes vencidos e próximos do vencimento', () => {
    expect(getExpiryState(item({ expiryDate: '2026-03-09' }), today)).toBe('expired');
    expect(getExpiryState(item({ expiryDate: '2026-03-25' }), today)).toBe('expiring');
    expect(getExpiryState(item({ expiryDate: '2026-04-09' }), today)).toBe('expiring');
    expect(getExpiryState(item({ expiryDate: '2026-04-11' }), today)).toBe('ok');
  });
});

describe('getStockHealth', () => {
  it('não pede atenção para itens inativos', () => {
    expect(getStockHealth(item({ quantity: 0, status: 'inactive' }), today).needsAttention).toBe(false);
  });

  it('marca atenção para saldo baixo ou validade crítica', () => {
    expect(getStockHealth(item({ quantity: 5 }), today).needsAttention).toBe(true);
    expect(getStockHealth(item({ expiryDate: '2026-01-01' }), today).needsAttention).toBe(true);
    expect(getStockHealth(item(), today).needsAttention).toBe(false);
  });
});

describe('summarizeInventory', () => {
  it('consolida a posição considerando apenas itens ativos', () => {
    const summary = summarizeInventory(
      [
        item({ id: '1' }),
        item({ id: '2', quantity: 0 }),
        item({ id: '3', quantity: 10, minQuantity: 20 }),
        item({ id: '4', expiryDate: '2026-01-05' }),
        item({ id: '5', expiryDate: '2026-03-20' }),
        item({ id: '6', quantity: 0, status: 'inactive' }),
      ],
      today,
    );

    expect(summary.total).toBe(5);
    expect(summary.out).toBe(1);
    expect(summary.low).toBe(1);
    expect(summary.expired).toBe(1);
    expect(summary.expiring).toBe(1);
    expect(summary.attention).toBe(4);
  });

  it('conta um item com saldo baixo e vencido uma única vez', () => {
    const summary = summarizeInventory([item({ quantity: 0, expiryDate: '2026-01-01' })], today);
    expect(summary.attention).toBe(1);
  });
});
