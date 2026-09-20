import { describe, it, expect } from 'vitest';
import { Appointment, Doctor, InventoryItem, Patient } from '../types';
import { buildReport, describeParameters, getPeriodRange, isWithinRange } from './reports';

const today = new Date(2026, 2, 10); // 10/03/2026

const patients: Patient[] = [
  { id: 'p1', name: 'Ana Lima', cpf: '529.982.247-25', birthDate: '1990-05-02', contact: '(11) 90000-0001', status: 'active' },
  { id: 'p2', name: 'Bruno Dias', cpf: '111.444.777-35', birthDate: '1980-02-10', contact: '(11) 90000-0002', status: 'inactive' },
];

const doctors: Doctor[] = [
  { id: 'd1', name: 'Dra. Ana Costa', crm: '54321-SP', specialty: 'Pediatria', contact: '-', availability: '-', status: 'active' },
  { id: 'd2', name: 'Dr. Luiz Melo', crm: '12345-SP', specialty: 'Cardiologia', contact: '-', availability: '-', status: 'active' },
];

const appointments: Appointment[] = [
  { id: 'a1', patientId: 'p1', doctorId: 'd1', type: 'Consulta', date: '2026-03-10', time: '09:00', status: 'Concluído' },
  { id: 'a2', patientId: 'p1', doctorId: 'd1', type: 'Exame', date: '2026-03-05', time: '10:00', status: 'Cancelado' },
  { id: 'a3', patientId: 'p2', doctorId: 'd2', type: 'Consulta', date: '2026-01-20', time: '11:00', status: 'Concluído' },
];

const inventory: InventoryItem[] = [
  { id: 'i1', name: 'Dipirona', batch: 'L1', expiryDate: '2027-01-01', quantity: 50, minQuantity: 10, status: 'active' },
  { id: 'i2', name: 'Seringa 5ml', batch: 'L2', expiryDate: '2026-03-15', quantity: 5, minQuantity: 20, status: 'active' },
  { id: 'i3', name: 'Luva', batch: 'L3', expiryDate: '2027-01-01', quantity: 5, minQuantity: 1, status: 'inactive' },
];

const data = { patients, doctors, appointments, inventory };

describe('getPeriodRange', () => {
  it('monta o intervalo de cada período', () => {
    expect(getPeriodRange('Hoje', today)).toMatchObject({ start: '2026-03-10', end: '2026-03-10' });
    expect(getPeriodRange('7dias', today)).toMatchObject({ start: '2026-03-04', end: '2026-03-10' });
    expect(getPeriodRange('30dias', today)).toMatchObject({ start: '2026-02-09', end: '2026-03-10' });
    expect(getPeriodRange('MesAtual', today)).toMatchObject({ start: '2026-03-01', end: '2026-03-10' });
  });
});

describe('isWithinRange', () => {
  it('inclui as bordas do intervalo', () => {
    const range = getPeriodRange('7dias', today);
    expect(isWithinRange('2026-03-04', range)).toBe(true);
    expect(isWithinRange('2026-03-10', range)).toBe(true);
    expect(isWithinRange('2026-03-03', range)).toBe(false);
  });
});

describe('buildReport - Atendimentos', () => {
  it('filtra de fato pelo período selecionado', () => {
    // Regressão: o período era só um rótulo no log e o CSV exportava a base toda.
    const week = buildReport('Atendimentos', '7dias', data, today);
    expect(week.rows).toHaveLength(2);
    expect(week.rows.map((row) => row[2])).toEqual(['Ana Lima', 'Ana Lima']);

    const day = buildReport('Atendimentos', 'Hoje', data, today);
    expect(day.rows).toHaveLength(1);
  });

  it('ordena por data e hora e resume o período', () => {
    const result = buildReport('Atendimentos', '30dias', data, today);
    expect(result.rows[0][0]).toBe('05/03/2026');
    expect(result.highlights[0]).toEqual({ label: 'Atendimentos no período', value: '2' });
    expect(result.highlights[1]).toEqual({ label: 'Concluídos', value: '1' });
  });
});

describe('buildReport - Produtividade', () => {
  it('agrega por profissional apenas com agenda no período', () => {
    const result = buildReport('Produtividade', '30dias', data, today);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual(['Dra. Ana Costa', 'Pediatria', 2, 1, 1, 0, '50%']);
  });
});

describe('buildReport - Pacientes', () => {
  it('exporta somente pacientes ativos', () => {
    const result = buildReport('Pacientes', 'Hoje', data, today);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0][0]).toBe('Ana Lima');
    expect(result.rows[0][2]).toBe('02/05/1990');
  });
});

describe('buildReport - Estoque', () => {
  it('descreve a situação de cada lote ativo', () => {
    const result = buildReport('Estoque', 'Hoje', data, today);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.find((row) => row[0] === 'Dipirona')?.[5]).toBe('Regular');
    expect(result.rows.find((row) => row[0] === 'Seringa 5ml')?.[5]).toBe('Abaixo do mínimo / A vencer');
  });
});

describe('describeParameters', () => {
  it('explicita quando o relatório não depende do período', () => {
    expect(describeParameters('Estoque', '7dias', today)).toBe('Posição atual (independe de período)');
    expect(describeParameters('Atendimentos', 'Hoje', today)).toBe('Hoje (10/03/2026 a 10/03/2026)');
  });
});
