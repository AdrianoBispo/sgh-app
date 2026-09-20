/**
 * Geração de IDs de documento.
 *
 * Os IDs precisam casar com `isValidId()` das regras do Firestore
 * (`^[a-zA-Z0-9_\-]+$`, até 128 caracteres).
 */
const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function generateId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(20));
    return Array.from(bytes, (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('');
  }
  // Último recurso (ambientes sem Web Crypto): timestamp + aleatório.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Normaliza um ID vindo de planilha para o formato aceito pelas regras. */
export function sanitizeId(value: unknown): string | null {
  const id = String(value ?? '').trim();
  if (!id || id.length > 128) return null;
  return /^[a-zA-Z0-9_-]+$/.test(id) ? id : null;
}
