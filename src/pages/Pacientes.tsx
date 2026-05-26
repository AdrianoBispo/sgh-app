import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Plus, Edit2, Ban, CheckCircle, FileText, Calendar as CalendarIcon, User, Activity } from 'lucide-react';
import { Patient } from '../types';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';

export function Pacientes() {
  const { patients, addPatient, updatePatient, currentUserRole, isDataLoaded, appointments, doctors } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; patient: Patient | null}>({isOpen: false, patient: null});
  const [summaryPatient, setSummaryPatient] = useState<Patient | null>(null);

  const canEdit = currentUserRole === 'admin' || currentUserRole === 'reception' || currentUserRole === 'nurse';

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cpf.includes(searchTerm)
  );

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newPatient: Patient = {
      id: editingPatient?.id || Math.random().toString(36).substr(2, 9),
      name: formData.get('name') as string,
      cpf: formData.get('cpf') as string,
      birthDate: formData.get('birthDate') as string,
      contact: formData.get('contact') as string,
      bloodType: formData.get('bloodType') as string,
      allergies: formData.get('allergies') as string,
      comorbidities: formData.get('comorbidities') as string,
      status: (formData.get('status') as any) || 'active',
    };

    if (editingPatient) updatePatient(newPatient);
    else addPatient(newPatient);
    
    setIsModalOpen(false);
  };

  const requestToggleStatus = (p: Patient) => {
    if (!canEdit) return;
    setConfirmModal({isOpen: true, patient: p});
  };

  const handleToggleStatus = () => {
    if (!confirmModal.patient) return;
    const p = confirmModal.patient;
    updatePatient({ ...p, status: p.status === 'active' ? 'inactive' : 'active' });
    setConfirmModal({isOpen: false, patient: null});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {canEdit && (
          <button 
            onClick={() => { setEditingPatient(null); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Paciente
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text"
              placeholder="Buscar por nome ou CPF..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
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
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>
                        {p.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => { setEditingPatient(p); setIsModalOpen(true); }}
                          className="text-primary-600 hover:text-primary-900 transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
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
        onClose={() => setIsModalOpen(false)} 
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
              <input required name="cpf" defaultValue={editingPatient?.cpf} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
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
              <input name="bloodType" defaultValue={editingPatient?.bloodType} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select name="status" defaultValue={editingPatient?.status || 'active'} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Alergias</label>
              <textarea name="allergies" defaultValue={editingPatient?.allergies} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Comorbidades</label>
              <textarea name="comorbidities" defaultValue={editingPatient?.comorbidities} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
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
            <div className="bg-primary-50 rounded-xl p-4 flex gap-4">
               <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center shrink-0">
                 <User className="w-6 h-6" />
               </div>
               <div>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                <h4 className="text-amber-800 font-semibold mb-2 flex items-center">
                  <Activity className="w-4 h-4 mr-1" />
                  Alergias Registradas
                </h4>
                <p className="text-amber-900 text-sm whitespace-pre-wrap">
                  {summaryPatient.allergies || 'Nenhuma alergia registrada.'}
                </p>
              </div>
              <div className="border border-blue-200 bg-blue-50 rounded-xl p-4">
                <h4 className="text-blue-800 font-semibold mb-2 flex items-center">
                  <FileText className="w-4 h-4 mr-1" />
                  Comorbidades / Obs.
                </h4>
                <p className="text-blue-900 text-sm whitespace-pre-wrap">
                  {summaryPatient.comorbidities || 'Nenhuma comorbidade registrada.'}
                </p>
              </div>
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
                onClick={() => setSummaryPatient(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
              >
                Fechar Resumo
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
