import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Edit2, XCircle, AlertTriangle, Calendar as CalendarIcon, LayoutList, Search } from 'lucide-react';
import { Appointment } from '../types';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Agendamentos() {
  const { appointments, addAppointment, updateAppointment, patients, doctors, currentUserRole, isDataLoaded } = useAppContext();
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [cancelModal, setCancelModal] = useState<{isOpen: boolean; appt: Appointment | null}>({isOpen: false, appt: null});
  const [cancelReason, setCancelReason] = useState('');
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [searchTerm, setSearchTerm] = useState('');

  const canEdit = currentUserRole === 'admin' || currentUserRole === 'reception';

  const filteredAppointments = appointments
    .filter(a => a.date === filterDate)
    .filter(a => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const pt = patients.find(p => p.id === a.patientId);
      const doc = doctors.find(d => d.id === a.doctorId);
      return pt?.name.toLowerCase().includes(term) || doc?.name.toLowerCase().includes(term);
    })
    .sort((a, b) => a.time.localeCompare(b.time));

  const handleFormChange = (e: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    const time = formData.get('time') as string;
    const doctorId = formData.get('doctorId') as string;

    if (date && time && doctorId) {
      const conflict = appointments.find(a => a.doctorId === doctorId && a.date === date && a.time === time && a.id !== editingAppt?.id && a.status !== 'Cancelado');
      if (conflict) {
        const doc = doctors.find(d => d.id === doctorId);
        setConflictError(`O profissional ${doc?.name || ''} já possui um agendamento para as ${time} no dia ${format(parseISO(date), 'dd/MM/yyyy')}.`);
      } else {
        setConflictError(null);
      }
    } else {
      setConflictError(null);
    }
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setConflictError(null);
    const formData = new FormData(e.currentTarget);
    
    const date = formData.get('date') as string;
    const time = formData.get('time') as string;
    const doctorId = formData.get('doctorId') as string;
    
    const conflict = appointments.find(a => a.doctorId === doctorId && a.date === date && a.time === time && a.id !== editingAppt?.id && a.status !== 'Cancelado');
    if (conflict) {
      const doc = doctors.find(d => d.id === doctorId);
      setConflictError(`O profissional ${doc?.name || ''} já possui um agendamento para as ${time} no dia ${format(parseISO(date), 'dd/MM/yyyy')}.`);
      return;
    }

    const newAppt: Appointment = {
      id: editingAppt?.id || Math.random().toString(36).substr(2, 9),
      patientId: formData.get('patientId') as string,
      doctorId: formData.get('doctorId') as string,
      type: formData.get('type') as any,
      date,
      time,
      status: (formData.get('status') as any) || 'Agendado',
      notes: formData.get('notes') as string,
    };

    if (editingAppt && editingAppt.id) updateAppointment(newAppt);
    else addAppointment(newAppt);
    
    setIsModalOpen(false);
  };

  const handleCellClick = (dayIso: string, hourPrefix: string) => {
    if (!canEdit) return;
    setEditingAppt({
      id: '',
      patientId: '',
      doctorId: '',
      type: 'Consulta',
      date: dayIso,
      time: `${hourPrefix}:00`,
      status: 'Agendado',
      notes: ''
    });
    setConflictError(null);
    setIsModalOpen(true);
  };

  const requestCancel = (a: Appointment) => {
    if (!canEdit) return;
    setCancelReason('');
    setCancelModal({isOpen: true, appt: a});
  };

  const handleCancel = () => {
    if (!cancelModal.appt) return;
    const a = cancelModal.appt;
    updateAppointment({ ...a, status: 'Cancelado', notes: `${a.notes || ''}\nCancelado: ${cancelReason}`.trim() });
    setCancelModal({isOpen: false, appt: null});
  };

  const statusColors = {
    'Agendado': 'bg-blue-100 text-blue-800',
    'Concluído': 'bg-emerald-100 text-emerald-800',
    'Cancelado': 'bg-gray-100 text-gray-600 line-through',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {canEdit ? (
          <button 
            onClick={() => { setEditingAppt(null); setConflictError(null); setIsModalOpen(true); }}
            className="flex items-center px-4 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Agendamento
          </button>
        ) : <div />}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <LayoutList className="w-4 h-4 mr-1.5" />
            Lista
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium transition ${viewMode === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <CalendarIcon className="w-4 h-4 mr-1.5" />
            Calendário
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
        <div className="p-6 border-b border-gray-100 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Data de Filtro:</label>
            <input 
              type="date"
              className="border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
          </div>
          <div className="relative flex-1 max-w-md w-full ml-auto">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nome do paciente ou médico..."
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        {viewMode === 'list' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-6 py-3">Horário</th>
                <th className="px-6 py-3">Paciente</th>
                <th className="px-6 py-3">Profissional</th>
                <th className="px-6 py-3">Tipo</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {!isDataLoaded ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-8"></div></td>
                  </tr>
                ))
              ) : filteredAppointments.length > 0 ? (
                filteredAppointments.map(a => {
                  const pt = patients.find(p => p.id === a.patientId);
                  const doc = doctors.find(d => d.id === a.doctorId);
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-semibold">{a.time}</td>
                      <td className="px-6 py-4">{pt?.name || 'Desconhecido'}</td>
                      <td className="px-6 py-4">{doc?.name || 'Indefinido'}</td>
                      <td className="px-6 py-4">{a.type}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[a.status]}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => { setEditingAppt(a); setConflictError(null); setIsModalOpen(true); }}
                            className="text-primary-600 hover:text-primary-900 transition"
                            title="Ver Detalhes/Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {canEdit && a.status === 'Agendado' && (
                            <button 
                              onClick={() => requestCancel(a)}
                              className="text-gray-400 hover:text-rose-600 transition"
                              title="Cancelar Agendamento"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Nenhum agendamento para esta data.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        ) : (
          <div className="overflow-x-auto p-4 bg-gray-50">
             <div className="min-w-[900px] border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white relative">
                {!isDataLoaded && (
                  <div className="absolute inset-0 bg-white/80 z-10 flex items-center justify-center backdrop-blur-[1px]">
                    <div className="animate-pulse text-gray-500 font-medium">Carregando calendário...</div>
                  </div>
                )}
                <div className="grid grid-cols-[80px_repeat(6,1fr)] border-b border-gray-200 bg-gray-50">
                    <div className="p-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider border-r border-gray-200">Hora</div>
                    {Array.from({ length: 6 }).map((_, i) => {
                      const day = addDays(startOfWeek(filterDate ? parseISO(filterDate) : new Date(), { weekStartsOn: 1 }), i);
                      return (
                        <div key={day.toISOString()} className={`p-3 text-center border-r border-gray-200 last:border-r-0 ${isSameDay(day, new Date()) ? 'bg-primary-50/50' : ''}`}>
                           <div className={`text-xs font-semibold ${isSameDay(day, new Date()) ? 'text-primary-700' : 'text-gray-500 uppercase'}`}>{format(day, 'EEEE', {locale: ptBR}).split('-')[0]}</div>
                           <div className={`text-lg font-bold mt-0.5 ${isSameDay(day, new Date()) ? 'text-primary-700' : 'text-gray-900'}`}>{format(day, 'dd/MM')}</div>
                        </div>
                      )
                    })}
                </div>
                
                <div className="flex flex-col">
                  {Array.from({ length: 11 }).map((_, i) => {
                    const hour = `${(i + 8).toString().padStart(2, '0')}:00`;
                    const hourPrefix = hour.substring(0, 2);
                    return (
                     <div key={hour} className="grid grid-cols-[80px_repeat(6,1fr)] border-b border-gray-100 last:border-b-0">
                        <div className="p-3 text-xs font-medium text-gray-400 border-r border-gray-200 flex items-start justify-center relative bg-gray-50/50">
                           <span className="-mt-1 bg-gray-50/50 block w-full text-center">{hour}</span>
                        </div>
                        {Array.from({ length: 6 }).map((_, j) => {
                           const day = addDays(startOfWeek(filterDate ? parseISO(filterDate) : new Date(), { weekStartsOn: 1 }), j);
                           const dayIso = format(day, 'yyyy-MM-dd');
                           const hourAppts = appointments.filter(a => {
                             if (a.date !== dayIso || a.time.substring(0, 2) !== hourPrefix || a.status === 'Cancelado') return false;
                             if (!searchTerm.trim()) return true;
                             const term = searchTerm.toLowerCase();
                             const pt = patients.find(p => p.id === a.patientId);
                             const doc = doctors.find(d => d.id === a.doctorId);
                             return pt?.name.toLowerCase().includes(term) || doc?.name.toLowerCase().includes(term);
                           });
                           
                           return (
                             <div 
                               key={dayIso} 
                               onClick={() => handleCellClick(dayIso, hourPrefix)}
                               className={`p-1.5 min-h-[100px] border-r border-gray-100 last:border-r-0 relative hover:bg-gray-50/50 transition cursor-crosshair group flex flex-col gap-1.5 ${isSameDay(day, new Date()) ? 'bg-primary-50/10' : ''}`}
                             >
                                {hourAppts.map(appt => {
                                   const ptName = patients.find(p => p.id === appt.patientId)?.name || 'Paciente';
                                   const doc = doctors.find(d => d.id === appt.doctorId);
                                   return (
                                      <div 
                                        key={appt.id} 
                                        onClick={(e) => { e.stopPropagation(); setEditingAppt(appt); setConflictError(null); setIsModalOpen(true); }}
                                        className={`mb-1.5 p-1.5 rounded-md text-xs cursor-pointer shadow-sm transition border ${appt.type === 'Consulta' ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 flex-col flex'}`}
                                        title={`${appt.time} - ${ptName} (${doc?.name || '-'})`}
                                      >
                                        <div className="font-semibold leading-tight mb-0.5" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{appt.time} - {ptName}</div>
                                        <div className="opacity-80 leading-tight text-[10px] truncate">{doc?.name}</div>
                                      </div>
                                   )
                                })}
                             </div>
                           );
                        })}
                     </div>
                  )})}
                </div>
             </div>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingAppt?.id ? 'Gerenciar Agendamento' : 'Novo Agendamento'}
      >
        <form onSubmit={handleSave} onChange={handleFormChange} className="space-y-4">
          {conflictError && (
            <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-xl flex items-start space-x-3 text-sm">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
              <div>
                <p className="font-semibold text-red-800">Conflito de Horário</p>
                <p>{conflictError}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
              <select required name="patientId" defaultValue={editingAppt?.patientId} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500">
                <option value="">Selecione...</option>
                {patients.filter(p => p.status === 'active').map(p => (
                  <option key={p.id} value={p.id}>{p.name} - CPF: {p.cpf}</option>
                ))}
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Profissional / Setor</label>
              <select required name="doctorId" defaultValue={editingAppt?.doctorId} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500">
                <option value="">Selecione...</option>
                {doctors.filter(d => d.status === 'active').map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select name="type" defaultValue={editingAppt?.type || 'Consulta'} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500">
                <option value="Consulta">Consulta</option>
                <option value="Exame">Exame</option>
              </select>
            </div>

            {canEdit && editingAppt?.id && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select name="status" defaultValue={editingAppt.status} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                  <option value="Agendado">Agendado</option>
                  <option value="Concluído">Concluído</option>
                  <option value="Cancelado">Cancelado</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input required type="date" name="date" defaultValue={editingAppt?.date} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
              <input required type="time" name="time" defaultValue={editingAppt?.time} disabled={!canEdit} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
              <textarea name="notes" defaultValue={editingAppt?.notes} rows={3} disabled={!canEdit && !['doctor','nurse'].includes(currentUserRole)} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-50 focus:ring-2 focus:ring-primary-500" />
            </div>
          </div>
          
          <div className="pt-4 flex justify-end gap-3">
             <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition">
              {canEdit || ['doctor','nurse'].includes(currentUserRole) ? 'Cancelar' : 'Fechar'}
             </button>
             {(canEdit || ['doctor','nurse'].includes(currentUserRole)) && (
               <button 
                 type="submit" 
                 disabled={!!conflictError}
                 className="px-4 py-2 text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition"
               >
                 Salvar
               </button>
             )}
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal({isOpen: false, appt: null})}
        onConfirm={handleCancel}
        title="Cancelar Agendamento"
        message={
          <div className="flex flex-col space-y-4 w-full min-w-[280px]">
            <p>
              Tem certeza que deseja cancelar este agendamento?
            </p>
            <div className="flex flex-col w-full">
              <label className="text-sm font-semibold text-gray-700 mb-1">Motivo do Cancelamento <span className="text-red-500">*</span></label>
              <textarea 
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-rose-500 outline-none" 
                rows={3} 
                placeholder="Informe o motivo para registro..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            {!cancelReason.trim() && <p className="text-xs text-rose-500">O motivo é obrigatório.</p>}
          </div>
        }
        confirmText="Confirmar Cancelamento"
        confirmDisabled={!cancelReason.trim()}
      />
    </div>
  );
}
