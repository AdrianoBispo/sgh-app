import { Appointment, Doctor, InventoryItem, Patient } from '../types';
import { formatDateBR, toISODate } from './date';
import { getStockHealth } from './inventory';

export type ReportType = 'Atendimentos' | 'Pacientes' | 'Estoque' | 'Produtividade';
export type ReportPeriod = 'Hoje' | '7dias' | '30dias' | 'MesAtual';

export interface ReportTypeInfo {
  value: ReportType;
  label: string;
  description: string;
  /** Falso para relatórios de fotografia do momento (ex.: posição de estoque). */
  periodAware: boolean;
}

export const REPORT_TYPES: ReportTypeInfo[] = [
  {
    value: 'Atendimentos',
    label: 'Atendimentos do período',
    description: 'Consultas e exames agendados dentro do intervalo selecionado.',
    periodAware: true,
  },
  {
    value: 'Produtividade',
    label: 'Produtividade por profissional',
    description: 'Total de atendimentos, conclusões, cancelamentos e faltas por profissional.',
    periodAware: true,
  },
  {
    value: 'Pacientes',
    label: 'Cadastro de pacientes ativos',
    description: 'Fotografia do cadastro ativo. Não depende do período.',
    periodAware: false,
  },
  {
    value: 'Estoque',
    label: 'Posição atual do estoque',
    description: 'Saldo, mínimo e validade de cada lote ativo. Não depende do período.',
    periodAware: false,
  },
];

export const REPORT_PERIODS: { value: ReportPeriod; label: string }[] = [
  { value: 'Hoje', label: 'Hoje' },
  { value: '7dias', label: 'Últimos 7 dias' },
  { value: '30dias', label: 'Últimos 30 dias' },
  { value: 'MesAtual', label: 'Mês atual' },
];

export interface PeriodRange {
  start: string;
  end: string;
  label: string;
}

/** Intervalo fechado `[start, end]` em datas locais `YYYY-MM-DD`. */
export function getPeriodRange(period: ReportPeriod, from: Date = new Date()): PeriodRange {
  const end = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let start = new Date(end);

  switch (period) {
    case 'Hoje':
      break;
    case '7dias':
      start.setDate(end.getDate() - 6);
      break;
    case '30dias':
      start.setDate(end.getDate() - 29);
      break;
    case 'MesAtual':
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      break;
  }

  const range = { start: toISODate(start), end: toISODate(end) };
  return { ...range, label: `${formatDateBR(range.start)} a ${formatDateBR(range.end)}` };
}

export function isWithinRange(date: string, range: PeriodRange): boolean {
  return date >= range.start && date <= range.end;
}

export interface ReportData {
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  inventory: InventoryItem[];
}

export interface ReportResult {
  headers: string[];
  rows: (string | number)[][];
  /** Linha de destaque exibida acima da prévia. */
  highlights: { label: string; value: string }[];
}

const nameById = <T extends { id: string; name: string }>(items: T[], id: string, fallback: string): string =>
  items.find((item) => item.id === id)?.name || fallback;

/**
 * Monta o conteúdo do relatório.
 *
 * O gerador antigo ignorava o período: o filtro era gravado apenas como texto
 * no log e o CSV sempre exportava a base inteira.
 */
export function buildReport(
  type: ReportType,
  period: ReportPeriod,
  data: ReportData,
  from: Date = new Date(),
): ReportResult {
  const range = getPeriodRange(period, from);

  if (type === 'Atendimentos') {
    const rows = data.appointments
      .filter((appointment) => isWithinRange(appointment.date, range))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map((appointment) => [
        formatDateBR(appointment.date),
        appointment.time,
        nameById(data.patients, appointment.patientId, 'Paciente removido'),
        nameById(data.doctors, appointment.doctorId, 'Profissional removido'),
        appointment.type,
        appointment.status,
        appointment.cid10 || '',
      ]);

    const concluded = rows.filter((row) => row[5] === 'Concluído').length;
    return {
      headers: ['Data', 'Hora', 'Paciente', 'Profissional', 'Tipo', 'Status', 'CID-10'],
      rows,
      highlights: [
        { label: 'Atendimentos no período', value: String(rows.length) },
        { label: 'Concluídos', value: String(concluded) },
        { label: 'Intervalo', value: range.label },
      ],
    };
  }

  if (type === 'Produtividade') {
    const inRange = data.appointments.filter((appointment) => isWithinRange(appointment.date, range));
    const rows = data.doctors
      .map((doctor) => {
        const own = inRange.filter((appointment) => appointment.doctorId === doctor.id);
        const concluded = own.filter((appointment) => appointment.status === 'Concluído').length;
        const canceled = own.filter((appointment) => appointment.status === 'Cancelado').length;
        const missed = own.filter((appointment) => appointment.status === 'Faltou').length;
        const rate = own.length ? Math.round((concluded / own.length) * 100) : 0;
        return [doctor.name, doctor.specialty, own.length, concluded, canceled, missed, `${rate}%`];
      })
      .filter((row) => Number(row[2]) > 0)
      .sort((a, b) => Number(b[2]) - Number(a[2]));

    return {
      headers: ['Profissional', 'Especialidade', 'Agendados', 'Concluídos', 'Cancelados', 'Faltas', 'Taxa de conclusão'],
      rows,
      highlights: [
        { label: 'Profissionais com agenda', value: String(rows.length) },
        { label: 'Atendimentos no período', value: String(inRange.length) },
        { label: 'Intervalo', value: range.label },
      ],
    };
  }

  if (type === 'Pacientes') {
    const active = data.patients
      .filter((patient) => patient.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return {
      headers: ['Nome', 'CPF', 'Nascimento', 'Contato', 'Tipo sanguíneo', 'Status'],
      rows: active.map((patient) => [
        patient.name,
        patient.cpf,
        formatDateBR(patient.birthDate, ''),
        patient.contact,
        patient.bloodType || '',
        'Ativo',
      ]),
      highlights: [
        { label: 'Pacientes ativos', value: String(active.length) },
        { label: 'Total cadastrado', value: String(data.patients.length) },
      ],
    };
  }

  const activeItems = data.inventory
    .filter((item) => item.status === 'active')
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  const situation = (item: InventoryItem): string => {
    const health = getStockHealth(item, from);
    const parts: string[] = [];
    if (health.level === 'out') parts.push('Sem saldo');
    else if (health.level === 'low') parts.push('Abaixo do mínimo');
    if (health.expiry === 'expired') parts.push('Vencido');
    else if (health.expiry === 'expiring') parts.push('A vencer');
    return parts.join(' / ') || 'Regular';
  };

  const rows = activeItems.map((item) => [
    item.name,
    item.batch,
    formatDateBR(item.expiryDate, ''),
    item.quantity,
    item.minQuantity,
    situation(item),
  ]);

  return {
    headers: ['Produto', 'Lote', 'Validade', 'Quantidade', 'Mínimo', 'Situação'],
    rows,
    highlights: [
      { label: 'Lotes ativos', value: String(rows.length) },
      { label: 'Com pendência', value: String(rows.filter((row) => row[5] !== 'Regular').length) },
    ],
  };
}

/** Texto legível dos parâmetros, persistido junto ao log do relatório. */
export function describeParameters(type: ReportType, period: ReportPeriod, from: Date = new Date()): string {
  const info = REPORT_TYPES.find((item) => item.value === type);
  if (!info?.periodAware) return 'Posição atual (independe de período)';
  const range = getPeriodRange(period, from);
  const label = REPORT_PERIODS.find((item) => item.value === period)?.label ?? period;
  return `${label} (${range.label})`;
}

export function reportFileName(type: ReportType, generatedAt: string): string {
  const stamp = generatedAt.replace(/[:.]/g, '-');
  return `${type.toLowerCase()}_${stamp}.csv`;
}
