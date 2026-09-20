export type Role = 'admin' | 'reception' | 'doctor' | 'pharmacy';

export type EntityStatus = 'active' | 'inactive';

export type AppointmentStatus =
  | 'Agendado'
  | 'Confirmado'
  | 'Aguardando Atendimento'
  | 'Em Andamento'
  | 'Concluído'
  | 'Cancelado'
  | 'Faltou';

export type AppointmentType = 'Consulta' | 'Exame';

export interface Patient {
  id: string;
  name: string;
  cpf: string;
  birthDate: string;
  contact: string;
  bloodType?: string;
  /** Alergias, comorbidades e observações clínicas. */
  description?: string;
  status: EntityStatus;
}

export interface Doctor {
  id: string;
  name: string;
  crm: string;
  specialty: string;
  contact: string;
  availability: string;
  email?: string;
  status: EntityStatus;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  type: AppointmentType;
  date: string;
  time: string;
  status: AppointmentStatus;
  notes?: string;
  /** Informado pelo médico durante o atendimento. */
  cid10?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  batch: string;
  expiryDate: string;
  quantity: number;
  minQuantity: number;
  status: EntityStatus;
}

export interface ReportLog {
  id: string;
  title: string;
  type: string;
  generatedAt: string;
  generatedBy: string;
  parameters: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  details: string;
  userId: string;
  timestamp: string;
  beforeData?: unknown;
  afterData?: unknown;
}

export interface SystemUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  cpf?: string;
  contact?: string;
  status: EntityStatus;
}
