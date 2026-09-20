import { Appointment, AppointmentStatus, Role } from '../types';

/** Ordem canônica do fluxo de atendimento. */
export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'Agendado',
  'Confirmado',
  'Aguardando Atendimento',
  'Em Andamento',
  'Concluído',
  'Cancelado',
  'Faltou',
];

/**
 * Estilos por status. Antes o mapa só cobria 3 dos 7 status, então
 * "Confirmado", "Aguardando Atendimento", "Em Andamento" e "Faltou"
 * renderizavam com `className="... undefined"` (etiqueta sem cor).
 */
export const STATUS_STYLES: Record<AppointmentStatus, string> = {
  'Agendado': 'bg-blue-100 text-blue-800',
  'Confirmado': 'bg-indigo-100 text-indigo-800',
  'Aguardando Atendimento': 'bg-amber-100 text-amber-800',
  'Em Andamento': 'bg-sky-100 text-sky-800',
  'Concluído': 'bg-emerald-100 text-emerald-800',
  'Cancelado': 'bg-gray-100 text-gray-600 line-through',
  'Faltou': 'bg-rose-100 text-rose-800',
};

/** Status que ainda ocupam a agenda do profissional. */
export const ACTIVE_STATUSES: AppointmentStatus[] = [
  'Agendado',
  'Confirmado',
  'Aguardando Atendimento',
  'Em Andamento',
  'Concluído',
];

/** Perfis que podem criar/reagendar e alterar os dados centrais da consulta. */
export const canManageSchedule = (role: Role): boolean => role === 'admin' || role === 'reception';

/** Perfis que registram evolução clínica (status clínico, observações, CID-10). */
export const canRecordCare = (role: Role): boolean => role === 'admin' || role === 'doctor';

const STATUSES_BY_ROLE: Record<Role, AppointmentStatus[]> = {
  admin: APPOINTMENT_STATUSES,
  reception: ['Agendado', 'Confirmado', 'Aguardando Atendimento', 'Cancelado', 'Faltou'],
  doctor: ['Aguardando Atendimento', 'Em Andamento', 'Concluído', 'Faltou'],
  pharmacy: [],
};

/**
 * Status que o perfil pode gravar, sempre incluindo o status atual.
 *
 * Sem incluir o atual, abrir um agendamento "Agendado" como médico deixava o
 * `<select>` recair na primeira opção ("Em Andamento") e salvar mudava o
 * status sem que ninguém pedisse.
 */
export function allowedStatusesFor(role: Role, current?: AppointmentStatus): AppointmentStatus[] {
  const allowed = STATUSES_BY_ROLE[role] ?? [];
  const withCurrent = current && !allowed.includes(current) ? [current, ...allowed] : allowed;
  return APPOINTMENT_STATUSES.filter((status) => withCurrent.includes(status));
}

export interface ConflictQuery {
  doctorId: string;
  date: string;
  time: string;
  ignoreId?: string;
}

/**
 * Retorna o agendamento que ocupa o mesmo profissional/data/hora.
 * Agendamentos cancelados ou com falta liberam o horário.
 */
export function findScheduleConflict(
  appointments: Appointment[],
  { doctorId, date, time, ignoreId }: ConflictQuery,
): Appointment | undefined {
  if (!doctorId || !date || !time) return undefined;
  return appointments.find(
    (appointment) =>
      appointment.doctorId === doctorId &&
      appointment.date === date &&
      appointment.time === time &&
      appointment.id !== ignoreId &&
      ACTIVE_STATUSES.includes(appointment.status),
  );
}

/** Normaliza um valor arbitrário (planilha/formulário) em um status válido. */
export function coerceStatus(value: unknown, fallback: AppointmentStatus = 'Agendado'): AppointmentStatus {
  const text = String(value ?? '').trim();
  return (APPOINTMENT_STATUSES as string[]).includes(text) ? (text as AppointmentStatus) : fallback;
}

/** Valida `HH:mm` dentro das 24 horas. */
export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test((time || '').trim());
}
