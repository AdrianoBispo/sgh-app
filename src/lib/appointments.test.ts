import { describe, it, expect } from 'vitest';
import { Appointment, AppointmentStatus } from '../types';
import {
  APPOINTMENT_STATUSES,
  STATUS_STYLES,
  allowedStatusesFor,
  canManageSchedule,
  canRecordCare,
  coerceStatus,
  findScheduleConflict,
  isValidTime,
} from './appointments';

const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'a1',
  patientId: 'p1',
  doctorId: 'd1',
  type: 'Consulta',
  date: '2026-03-10',
  time: '09:00',
  status: 'Agendado',
  ...overrides,
});

describe('STATUS_STYLES', () => {
  it('cobre todos os status do domínio', () => {
    // Regressão: o mapa anterior tinha 3 das 7 chaves e as demais etiquetas
    // renderizavam sem cor.
    for (const status of APPOINTMENT_STATUSES) {
      expect(STATUS_STYLES[status]).toBeTruthy();
    }
  });
});

describe('findScheduleConflict', () => {
  const agenda = [appointment(), appointment({ id: 'a2', time: '10:00', status: 'Cancelado' })];

  it('detecta o mesmo profissional no mesmo horário', () => {
    expect(findScheduleConflict(agenda, { doctorId: 'd1', date: '2026-03-10', time: '09:00' })?.id).toBe('a1');
  });

  it('ignora o próprio agendamento em edição', () => {
    expect(findScheduleConflict(agenda, { doctorId: 'd1', date: '2026-03-10', time: '09:00', ignoreId: 'a1' })).toBeUndefined();
  });

  it('libera horários de agendamentos cancelados', () => {
    expect(findScheduleConflict(agenda, { doctorId: 'd1', date: '2026-03-10', time: '10:00' })).toBeUndefined();
  });

  it('não acusa conflito entre profissionais diferentes', () => {
    expect(findScheduleConflict(agenda, { doctorId: 'd2', date: '2026-03-10', time: '09:00' })).toBeUndefined();
  });

  it('ignora consultas sem dados suficientes', () => {
    expect(findScheduleConflict(agenda, { doctorId: '', date: '2026-03-10', time: '09:00' })).toBeUndefined();
  });
});

describe('allowedStatusesFor', () => {
  it('sempre inclui o status atual do agendamento', () => {
    // Regressão: como "Agendado" não estava na lista do médico, o select caía
    // na primeira opção e salvar mudava o status sem intenção.
    expect(allowedStatusesFor('doctor', 'Agendado')).toContain('Agendado');
  });

  it('dá ao admin todos os status, sem duplicatas', () => {
    const statuses = allowedStatusesFor('admin');
    expect(statuses).toEqual(APPOINTMENT_STATUSES);
    expect(new Set(statuses).size).toBe(statuses.length);
  });

  it('não deixa a recepção concluir atendimento clínico', () => {
    expect(allowedStatusesFor('reception')).not.toContain('Concluído');
    expect(allowedStatusesFor('reception')).toContain('Confirmado');
  });

  it('não oferece status para a farmácia', () => {
    expect(allowedStatusesFor('pharmacy')).toEqual([]);
  });

  it('mantém a ordem canônica do fluxo', () => {
    const statuses = allowedStatusesFor('doctor', 'Agendado');
    expect(statuses).toEqual(APPOINTMENT_STATUSES.filter((status) => statuses.includes(status)));
  });
});

describe('permissões', () => {
  it('separa quem agenda de quem registra o atendimento', () => {
    expect(canManageSchedule('reception')).toBe(true);
    expect(canManageSchedule('doctor')).toBe(false);
    expect(canRecordCare('doctor')).toBe(true);
    expect(canRecordCare('reception')).toBe(false);
    expect(canManageSchedule('admin') && canRecordCare('admin')).toBe(true);
  });
});

describe('coerceStatus', () => {
  it('normaliza valores vindos de planilha', () => {
    expect(coerceStatus('Concluído')).toBe('Concluído');
    expect(coerceStatus('qualquer coisa')).toBe('Agendado');
    expect(coerceStatus(undefined, 'Faltou' as AppointmentStatus)).toBe('Faltou');
  });
});

describe('isValidTime', () => {
  it('valida horários no formato HH:MM', () => {
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('23:59')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:00')).toBe(false);
    expect(isValidTime('')).toBe(false);
  });
});
