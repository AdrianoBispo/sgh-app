import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Search, Plus, Edit2, Ban, CheckCircle } from 'lucide-react';
import { Doctor } from '../types';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';

export function Medicos() {
  const { doctors, addDoctor, updateDoctor, currentUserRole, isDataLoaded } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; doctor: Doctor | null}>({isOpen: false, doctor: null});

  const canEdit = currentUserRole === 'admin';

  const filteredDoctors = doctors.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.crm.includes(searchTerm) || 
    d.specialty.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newDoc: Doctor = {
      id: editingDoctor?.id || Math.random().toString(36).substr(2, 9),
      name: formData.get('name') as string,
      crm: formData.get('crm') as string,
      specialty: formData.get('specialty') as string,
      contact: formData.get('contact') as string,
      availability: formData.get('availability') as string,
      status: (formData.get('status') as any) || 'active',
    };

    if (editingDoctor) updateDoctor(newDoc);
    else addDoctor(newDoc);
    
    setIsModalOpen(false);
  };

  const requestToggleStatus = (d: Doctor) => {
    if (!canEdit) return;
    setConfirmModal({isOpen: true, doctor: d});
  };

  const handleToggleStatus = () => {
    if (!confirmModal.doctor) return;
    const d = confirmModal.doctor;
    updateDoctor({ ...d, status: d.status === 'active' ? 'inactive' : 'active' });
    setConfirmModal({isOpen: false, doctor: null});
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {canEdit && (
          <button 
            onClick={() => { setEditingDoctor(null); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Médico
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <div className="p-6 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text"
              placeholder="Buscar por nome, CRM ou especialidade..."
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
                <th className="px-6 py-3">CRM</th>
                <th className="px-6 py-3">Especialidade</th>
                <th className="px-6 py-3">Disponibilidade</th>
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
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-full"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                  </tr>
                ))
              ) : filteredDoctors.length > 0 ? (
                filteredDoctors.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium">{d.name}</td>
                    <td className="px-6 py-4">{d.crm}</td>
                    <td className="px-6 py-4">{d.specialty}</td>
                    <td className="px-6 py-4 text-gray-500">{d.availability}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${d.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>
                        {d.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => { setEditingDoctor(d); setIsModalOpen(true); }}
                          className="text-primary-600 hover:text-primary-900 transition"
                          title="Ver/Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {canEdit && (
                          <button 
                            onClick={() => requestToggleStatus(d)}
                            className={`transition ${d.status === 'active' ? 'text-gray-400 hover:text-rose-600' : 'text-gray-400 hover:text-emerald-600'}`}
                            title={d.status === 'active' ? 'Desativar' : 'Ativar'}
                          >
                            {d.status === 'active' ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">Nenhum médico encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingDoctor ? 'Editar Médico' : 'Novo Médico'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
              <input required name="name" defaultValue={editingDoctor?.name} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CRM</label>
              <input required name="crm" defaultValue={editingDoctor?.crm} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Especialidade</label>
              <input required name="specialty" defaultValue={editingDoctor?.specialty} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contato</label>
              <input required name="contact" defaultValue={editingDoctor?.contact} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Horários de Disponibilidade</label>
              <input required name="availability" defaultValue={editingDoctor?.availability} disabled={!canEdit} placeholder="Ex: Segundas e Quartas, 08:00 às 12:00" className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
            </div>
            {canEdit && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select name="status" defaultValue={editingDoctor?.status || 'active'} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
            )}
          </div>
          {canEdit && (
            <div className="pt-4 flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition">Cancelar</button>
              <button type="submit" className="px-4 py-2 text-white bg-primary-600 hover:bg-primary-700 rounded-lg font-medium transition">Salvar Médico</button>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({isOpen: false, doctor: null})}
        onConfirm={handleToggleStatus}
        title={confirmModal.doctor?.status === 'active' ? "Desativar Médico" : "Ativar Médico"}
        message={
          <span>
            Tem certeza que deseja <strong>{confirmModal.doctor?.status === 'active' ? 'desativar' : 'ativar'}</strong> o cadastro do médico <strong>{confirmModal.doctor?.name}</strong>?
          </span>
        }
        confirmText={confirmModal.doctor?.status === 'active' ? "Desativar" : "Ativar"}
        isDestructive={confirmModal.doctor?.status === 'active'}
      />
    </div>
  );
}
