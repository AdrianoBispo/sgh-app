export type Role = 'admin' | 'reception' | 'doctor' | 'nurse' | 'pharmacy';

export interface Patient {
  id: string;
  name: string;
  cpf: string;
  birthDate: string;
  contact: string;
  bloodType?: string;
  allergies?: string;
  comorbidities?: string;
  status: 'active' | 'inactive';
}

export interface Doctor {
  id: string;
  name: string;
  crm: string;
  specialty: string;
  contact: string;
  availability: string;
  status: 'active' | 'inactive';
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  type: 'Consulta' | 'Exame';
  date: string;
  time: string;
  status: 'Agendado' | 'Concluído' | 'Cancelado';
  notes?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  batch: string;
  expiryDate: string;
  quantity: number;
  minQuantity: number;
  status: 'active' | 'inactive';
}

export interface ReportLog {
  id: string;
  title: string;
  type: string;
  generatedAt: string;
  generatedBy: string;
  parameters: string;
}
