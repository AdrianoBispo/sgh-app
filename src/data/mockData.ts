import { Patient, Doctor, Appointment, InventoryItem, ReportLog, AuditLog } from '../types';

export const mockPatients: Patient[] = [
  { id: '1', name: 'João Silva', cpf: '111.222.333-44', birthDate: '1985-04-12', contact: '(11) 98888-7777', bloodType: 'O+', allergies: 'Amendoim', status: 'active' },
  { id: '2', name: 'Maria Oliveira', cpf: '222.333.444-55', birthDate: '1990-08-25', contact: '(11) 97777-6666', status: 'active' },
  { id: '3', name: 'Antônio Souza', cpf: '333.444.555-66', birthDate: '1975-11-03', contact: '(11) 96666-5555', comorbidities: 'Hipertensão', status: 'inactive' }
];

export const mockDoctors: Doctor[] = [
  { id: '1', name: 'Dr. Carlos Mendes', crm: '12345-SP', specialty: 'Cardiologia', contact: '(11) 91111-2222', availability: 'Seg/Qua - Manhã', status: 'active' },
  { id: '2', name: 'Dra. Ana Costa', crm: '54321-SP', specialty: 'Pediatria', contact: '(11) 93333-4444', availability: 'Ter/Qui - Tarde', status: 'active' },
];

const today = new Date().toISOString().split('T')[0];

export const mockAppointments: Appointment[] = [
  { id: '1', patientId: '1', doctorId: '1', type: 'Consulta', date: today, time: '09:00', status: 'Agendado', notes: 'Primeira consulta' },
  { id: '2', patientId: '2', doctorId: '2', type: 'Exame', date: today, time: '14:30', status: 'Concluído' },
];

export const mockInventory: InventoryItem[] = [
  { id: '1', name: 'Paracetamol 500mg (Cx c/ 50)', batch: 'LOTE-123', expiryDate: '2025-12-01', quantity: 500, minQuantity: 100, status: 'active' },
  { id: '2', name: 'Seringa Descartável 5ml', batch: 'LOTE-456', expiryDate: '2026-06-15', quantity: 80, minQuantity: 200, status: 'active' }, // Low stock
  { id: '3', name: 'Dipirona Sódica 500mg/ml', batch: 'LOTE-789', expiryDate: '2024-01-10', quantity: 300, minQuantity: 150, status: 'active' }, 
];

export const mockReportLogs: ReportLog[] = [
  { id: '1', title: 'Relatório de Atendimentos', type: 'Atendimentos', generatedAt: new Date().toISOString(), generatedBy: 'Admin', parameters: 'Data: Hoje' }
];

export const mockAuditLogs: AuditLog[] = [
  { id: '1', action: 'Exclusão Lógica (Paciente)', entityType: 'Paciente', entityId: '3', entityName: 'Antônio Souza', details: 'Desativou o paciente Antônio Souza', userId: 'admin', timestamp: new Date(Date.now() - 86400000).toISOString() }
];
