import { InventoryItem } from '../types';
import { daysUntil } from './date';

/** Janela (em dias) em que um lote passa a ser sinalizado como "a vencer". */
export const EXPIRY_WARNING_DAYS = 30;

export type StockLevel = 'out' | 'low' | 'ok';
export type ExpiryState = 'expired' | 'expiring' | 'ok';

export interface StockHealth {
  level: StockLevel;
  expiry: ExpiryState;
  daysToExpiry: number | null;
  /** Item ativo que exige ação da farmácia (repor ou descartar). */
  needsAttention: boolean;
}

export function getStockLevel(item: InventoryItem): StockLevel {
  if (item.quantity <= 0) return 'out';
  return item.quantity <= item.minQuantity ? 'low' : 'ok';
}

export function getExpiryState(item: InventoryItem, from: Date = new Date()): ExpiryState {
  const days = daysUntil(item.expiryDate, from);
  if (days === null) return 'ok';
  if (days < 0) return 'expired';
  return days <= EXPIRY_WARNING_DAYS ? 'expiring' : 'ok';
}

export function getStockHealth(item: InventoryItem, from: Date = new Date()): StockHealth {
  const level = getStockLevel(item);
  const expiry = getExpiryState(item, from);
  return {
    level,
    expiry,
    daysToExpiry: daysUntil(item.expiryDate, from),
    needsAttention: item.status === 'active' && (level !== 'ok' || expiry !== 'ok'),
  };
}

export interface InventorySummary {
  total: number;
  low: number;
  out: number;
  expired: number;
  expiring: number;
  /** Itens ativos com qualquer pendência (sem contar o mesmo item duas vezes). */
  attention: number;
}

/** Consolida a posição do estoque ativo para o painel e para os alertas. */
export function summarizeInventory(items: InventoryItem[], from: Date = new Date()): InventorySummary {
  const active = items.filter((item) => item.status === 'active');
  const summary: InventorySummary = { total: active.length, low: 0, out: 0, expired: 0, expiring: 0, attention: 0 };

  for (const item of active) {
    const health = getStockHealth(item, from);
    if (health.level === 'out') summary.out++;
    else if (health.level === 'low') summary.low++;
    if (health.expiry === 'expired') summary.expired++;
    else if (health.expiry === 'expiring') summary.expiring++;
    if (health.needsAttention) summary.attention++;
  }

  return summary;
}
