import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Plus, Edit2, Ban, CheckCircle, FileText, Calendar as CalendarIcon, User, Activity, Download, FileOutput } from 'lucide-react';
import { Patient } from '../types';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { validateCPF } from '../lib/validators';
import { generatePatientSummaryPDF, generateDocumentPDF } from '../lib/pdf';
import { ImportExportButtons } from '../components/ui/ImportExportButtons';

export function Pacientes() {
  const { patients, addPatient, updatePatient, currentUserRole, user, isDataLoaded, appointments, doctors, addAuditLog } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; patient: Patient | null}>({isOpen: false, patient: null});
  const [summaryPatient, setSummaryPatient] = useState<Patient | null>(null);
  const [docMenuOpen, setDocMenuOpen] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);

  const canEdit = currentUserRole === 'admin' || currentUserRole === 'reception';

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.cpf.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const cpf = formData.get('cpf') as string;
    
    if (!validateCPF(cpf)) {
      setCpfError('O CPF deve estar no formato válido: XXX.XXX.XXX-XX');
      return;
    }
    
    setCpfError(null);
    
    const newPatient: Patient = {
      id: editingPatient?.id || Math.random().toString(36).substr(2, 9),
      name: formData.get('name') as string,
      cpf,
      birthDate: formData.get('birthDate') as string,
      contact: formData.get('contact') as string,
      bloodType: formData.get('bloodType') as string,
      description: formData.get('description') as string,
      status: (formData.get('status') as any) || 'active',
    };

    if (editingPatient) {
      updatePatient(newPatient);
      addAuditLog({
        id: Math.random().toString(36).substr(2, 9),
        action: 'Edição de Perfil (Paciente)',
        entityType: 'Paciente',
        entityId: newPatient.id,
        entityName: newPatient.name,
        details: `Atualizou os dados de ${newPatient.name}`,
        userId: user?.uid || currentUserRole || 'unknown',
        timestamp: new Date().toISOString(),
        beforeData: editingPatient,
        afterData: newPatient
      });
    } else {
      addPatient(newPatient);
    }
    
    setIsModalOpen(false);
  };

  const requestToggleStatus = (p: Patient) => {
    if (!canEdit) return;
    setConfirmModal({isOpen: true, patient: p});
  };

  const handleToggleStatus = () => {
    if (!confirmModal.patient) return;
    const p = confirmModal.patient;
    const newStatus = p.status === 'active' ? 'inactive' : 'active';
    updatePatient({ ...p, status: newStatus });
    
    if (newStatus === 'inactive') {
      addAuditLog({
        id: Math.random().toString(36).substr(2, 9),
        action: 'Exclusão Lógica (Paciente)',
        entityType: 'Paciente',
        entityId: p.id,
        entityName: p.name,
        details: `Desativou o paciente ${p.name}`,
        userId: user?.uid || currentUserRole || 'unknown',
        timestamp: new Date().toISOString(),
        beforeData: p,
        afterData: { ...p, status: newStatus }
      });
    }

    setConfirmModal({isOpen: false, patient: null});
  };

  const handleImport = async (data: any[]) => {
    let count = 0;
    for (const row of data) {
      if (row.name && row.cpf) {
        await addPatient({
          id: row.id || Math.random().toString(36).substr(2, 9),
          name: String(row.name),
          cpf: String(row.cpf),
          birthDate: row.birthDate || new Date().toISOString().split('T')[0],
          contact: row.contact || '',
          address: row.address || '',
          bloodType: row.bloodType || '',
          description: row.description || '',
          status: row.status === 'inactive' ? 'inactive' : 'active'
        });
        count++;
      }
    }
    if (count > 0) alert(`${count} paciente(s) importado(s) com sucesso!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {canEdit && (
          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
            <ImportExportButtons 
              onImport={handleImport}
              exportData={patients}
              exportFileName="pacientes"
            />
            <button 
              onClick={() => { setEditingPatient(null); setIsModalOpen(true); }}
              className="flex items-center px-4 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Paciente
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text"
              placeholder="Buscar por nome ou CPF..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary-500 outline-none text-sm"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Apenas Ativos</option>
            <option value="inactive">Apenas Inativos</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">CPF</th>
                <th className="px-6 py-3">Contato</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {!isDataLoaded ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                  </tr>
                ))
              ) : filteredPatients.length > 0 ? (
                filteredPatients.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setSummaryPatient(p)}
                        className="font-medium text-primary-600 hover:text-primary-800 hover:underline text-left"
                        title="Ver Resumo do Paciente"
                      >
                        {p.name}
                      </button>
                    </td>
                    <td className="px-6 py-4">{p.cpf}</td>
                    <td className="px-6 py-4">{p.contact}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5 ${p.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
                        {p.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {canEdit && (
                          <button 
                            onClick={() => { setEditingPatient(p); setIsModalOpen(true); }}
                            className="text-primary-600 hover:text-primary-900 transition"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canEdit && currentUserRole === 'admin' && (
                          <button 
                            onClick={() => requestToggleStatus(p)}
                            className={`transition ${p.status === 'active' ? 'text-gray-400 hover:text-rose-600' : 'text-gray-400 hover:text-emerald-600'}`}
                            title={p.status === 'active' ? 'Desativar' : 'Ativar'}
                          >
                            {p.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Nenhum paciente encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); setCpfError(null); }} 
        title={editingPatient ? 'Editar Paciente' : 'Novo Paciente'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <input required name="name" defaultValue={editingPatient?.name} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
              <input required name="cpf" defaultValue={editingPatient?.cpf} onChange={() => setCpfError(null)} placeholder="Ex: 111.222.333-44" className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${cpfError ? 'border-red-500' : 'border-gray-300'}`} />
              {cpfError && <p className="text-red-500 text-xs mt-1">{cpfError}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
              <input required type="date" name="birthDate" defaultValue={editingPatient?.birthDate} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contato (Telefone)</label>
              <input required name="contact" defaultValue={editingPatient?.contact} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Sanguíneo</label>
              <select name="bloodType" defaultValue={editingPatient?.bloodType || ''} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="">Selecione...</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" defaultValue={editingPatient?.status || 'active'} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <textarea name="description" defaultValue={editingPatient?.description} rows={3} placeholder="Alergias, Comorbidades e Observações Clínicas" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition">Cancelar</button>
            <button type="submit" className="px-4 py-2 text-white bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition">Salvar Paciente</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({isOpen: false, patient: null})}
        onConfirm={handleToggleStatus}
        title={confirmModal.patient?.status === 'active' ? "Desativar Paciente" : "Ativar Paciente"}
        message={
          <span>
            Tem certeza que deseja <strong>{confirmModal.patient?.status === 'active' ? 'desativar' : 'ativar'}</strong> o cadastro do paciente <strong>{confirmModal.patient?.name}</strong>?
          </span>
        }
        confirmText={confirmModal.patient?.status === 'active' ? "Desativar" : "Ativar"}
        isDestructive={confirmModal.patient?.status === 'active'}
      />

      <Modal
        isOpen={!!summaryPatient}
        onClose={() => setSummaryPatient(null)}
        title="Resumo do Paciente"
      >
        {summaryPatient && (
           <div className="space-y-6">
            <div className="bg-primary-50 rounded-xl p-4 flex gap-4 relative">
               <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center shrink-0">
                 <User className="w-6 h-6" />
               </div>
               <div className="flex-1">
                  <h3 className="font-bold text-lg text-gray-900">{summaryPatient.name}</h3>
                  <p className="text-sm text-gray-600">CPF: {summaryPatient.cpf} | Nasc: {new Date(summaryPatient.birthDate).toLocaleDateString('pt-BR')}</p>
                  <p className="text-sm text-gray-600">Contato: {summaryPatient.contact}</p>
                  <div className="mt-2 flex gap-2">
                    {summaryPatient.bloodType && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded-full border border-red-200">
                        Sangue: {summaryPatient.bloodType}
                      </span>
                    )}
                  </div>
               </div>
            </div>

            <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
              <h4 className="text-blue-800 font-semibold mb-2 flex items-center">
                <FileText className="w-4 h-4 mr-1" />
                Descrição / Observações Clínicas
              </h4>
              <p className="text-blue-900 text-sm whitespace-pre-wrap">
                {summaryPatient.description || 'Nenhuma descrição registrada.'}
              </p>
            </div>

            <div>
              <h4 className="font-bold text-gray-800 mb-3 flex items-center border-b pb-2">
                <CalendarIcon className="w-4 h-4 mr-2" />
                Histórico de Consultas e Exames
              </h4>
              <div className="max-h-48 overflow-y-auto space-y-3 pr-2">
                { appointments.filter(a => a.patientId === summaryPatient.id).length > 0 ? (
                  appointments
                    .filter(a => a.patientId === summaryPatient.id)
                    .sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime())
                    .map(a => {
                      const doc = doctors.find(d => d.id === a.doctorId);
                      return (
                        <div key={a.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm">
                           <div className="flex justify-between items-start mb-1">
                             <span className="font-semibold text-gray-800">{new Date(`${a.date}T12:00:00`).toLocaleDateString('pt-BR')} às {a.time}</span>
                             <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                               a.status === 'Concluído' ? 'bg-emerald-100 text-emerald-800' :
                               a.status === 'Cancelado' ? 'bg-gray-200 text-gray-600' :
                               'bg-primary-100 text-primary-800'
                             }`}>
                               {a.status}
                             </span>
                           </div>
                           <p className="text-gray-600"><span className="font-medium">Médico:</span> {doc?.name || 'Desconhecido'} ({a.type})</p>
                           {a.notes && <p className="text-gray-500 mt-1 italic">Obs: {a.notes}</p>}
                           
                           <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
                             <button onClick={() => generateDocumentPDF(summaryPatient, a, doc, 'Comprovante')} className="text-xs flex items-center px-2 py-1 rounded bg-white border border-gray-300 hover:bg-primary-50 text-gray-700 hover:text-primary-700 font-medium transition">
                               <FileOutput className="w-3 h-3 mr-1" /> Comprovante
                             </button>
                             <button onClick={() => generateDocumentPDF(summaryPatient, a, doc, 'Atestado')} className="text-xs flex items-center px-2 py-1 rounded bg-white border border-gray-300 hover:bg-primary-50 text-gray-700 hover:text-primary-700 font-medium transition">
                               <FileOutput className="w-3 h-3 mr-1" /> Atestado
                             </button>
                             <button onClick={() => generateDocumentPDF(summaryPatient, a, doc, 'Receituário')} className="text-xs flex items-center px-2 py-1 rounded bg-white border border-gray-300 hover:bg-primary-50 text-gray-700 hover:text-primary-700 font-medium transition">
                               <FileOutput className="w-3 h-3 mr-1" /> Receituário
                             </button>
                             <button onClick={() => generateDocumentPDF(summaryPatient, a, doc, 'Encaminhamento')} className="text-xs flex items-center px-2 py-1 rounded bg-white border border-gray-300 hover:bg-primary-50 text-gray-700 hover:text-primary-700 font-medium transition">
                               <FileOutput className="w-3 h-3 mr-1" /> Guia / Encaminhamento
                             </button>
                           </div>
                        </div>
                      )
                    })
                ) : (
                  <p className="text-sm text-gray-500 text-center py-4">Nenhum agendamento encontrado para este paciente.</p>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => generatePatientSummaryPDF(summaryPatient, appointments.filter(a => a.patientId === summaryPatient.id), doctors)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition"
              >
                <Download className="w-5 h-5" /> Exportar Resumo
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
