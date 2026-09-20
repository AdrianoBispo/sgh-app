/**
 * Utilitários de data.
 *
 * Regra de ouro do projeto: datas de negócio (nascimento, agenda, validade) são
 * armazenadas como `YYYY-MM-DD` e representam um dia do calendário local, sem
 * fuso. Converter essas strings com `new Date('2024-05-10')` faz o JS
 * interpretá-las como UTC meia-noite, o que exibe o dia anterior em qualquer
 * fuso negativo (como o do Brasil). Todas as conversões passam por aqui.
 */

/** Data de hoje no fuso do usuário, no formato `YYYY-MM-DD`. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Converte um `Date` para `YYYY-MM-DD` usando o fuso local. */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converte `YYYY-MM-DD` em um `Date` ancorado ao meio-dia local, evitando o
 * deslocamento de um dia causado pelo horário de verão e por fusos negativos.
 */
export function parseISODate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formata `YYYY-MM-DD` como `dd/MM/yyyy`. Retorna o fallback se inválida. */
export function formatDateBR(iso: string | undefined, fallback = '—'): string {
  const date = parseISODate(iso || '');
  return date ? date.toLocaleDateString('pt-BR') : fallback;
}

/** Formata um ISO datetime completo como `dd/MM/yyyy, HH:mm:ss`. */
export function formatDateTimeBR(iso: string | undefined, fallback = '—'): string {
  if (!iso) return fallback;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleDateString('pt-BR') + ', ' + date.toLocaleTimeString('pt-BR');
}

/** Diferença em dias inteiros entre `iso` e hoje (negativo = no passado). */
export function daysUntil(iso: string, from: Date = new Date()): number | null {
  const target = parseISODate(iso);
  if (!target) return null;
  const reference = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12, 0, 0, 0);
  return Math.round((target.getTime() - reference.getTime()) / 86_400_000);
}

/** Idade em anos completos a partir da data de nascimento. */
export function ageFromBirthDate(iso: string, from: Date = new Date()): number | null {
  const birth = parseISODate(iso);
  if (!birth) return null;
  let age = from.getFullYear() - birth.getFullYear();
  const monthDiff = from.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && from.getDate() < birth.getDate())) age--;
  return age < 0 ? null : age;
}

/** Combina `YYYY-MM-DD` + `HH:mm` em um timestamp local ordenável. */
export function dateTimeValue(date: string, time: string): number {
  const day = parseISODate(date);
  if (!day) return 0;
  const [hours = '0', minutes = '0'] = (time || '').split(':');
  day.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
  return day.getTime();
}
