import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { Appointment } from '../types';
import { CheckCircle } from 'lucide-react';

export function Dashboard() {
  const { patients, doctors, appointments, inventory, updateAppointment, isDataLoaded } = useAppContext();
  const navigate = useNavigate();
  const [completeModal, setCompleteModal] = useState<{isOpen: boolean; appt: Appointment | null}>({isOpen: false, appt: null});

  const activePatients = patients.filter(p => p.status === 'active').length;
  const capacityPercentage = Math.min(100, Math.round((activePatients / 250) * 100)); // Estimated cap

  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter(a => a.date === today);
  const todayAppointmentsCount = todayAppointments.length;
  
  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const am = appointments.filter(a => a.date === dateStr);
    return {
      name: format(d, 'dd/MM', { locale: ptBR }),
      Consultas: am.filter(a => a.type === 'Consulta').length,
      Exames: am.filter(a => a.type === 'Exame').length,
    };
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 md:grid-rows-6 gap-4 flex-1">
      
      {/* Stats - Today's Appointments */}
      <div className="md:col-span-3 md:row-span-2 bg-primary-600 rounded-3xl p-6 text-white shadow-lg flex flex-col justify-between">
        <div>
          <p className="text-primary-100 text-sm font-medium">Agendamentos Hoje</p>
          {!isDataLoaded ? (
            <div className="h-10 bg-primary-500/50 rounded w-16 mt-1 animate-pulse"></div>
          ) : (
            <h2 className="text-4xl font-bold mt-1">{todayAppointmentsCount}</h2>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-primary-100 bg-primary-700/50 p-2 rounded-xl mt-4 md:mt-0 max-w-fit">
          <span className="font-bold text-emerald-300">Hoje</span> agenda do dia
        </div>
      </div>

      {/* Stats - Active Patients */}
      <div className="md:col-span-3 md:row-span-2 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">Pacientes Cadastrados Ativos</p>
          {!isDataLoaded ? (
            <div className="h-10 bg-gray-200 rounded w-16 mt-1 animate-pulse"></div>
          ) : (
            <h2 className="text-4xl font-bold text-gray-800 mt-1">{activePatients}</h2>
          )}
        </div>
        <div className="mt-4 md:mt-0">
          <div className="h-1.5 w-full bg-gray-100 rounded-full mb-2">
            <div className="bg-primary-600 h-1.5 rounded-full" style={{ width: `${capacityPercentage}%` }}></div>
          </div>
          <p className="text-xs text-gray-400">{capacityPercentage}% base estimada ativa</p>
        </div>
      </div>

      {/* Volume Chart */}
      <div className="md:col-span-6 md:row-span-2 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
        <h3 className="text-gray-800 font-bold text-lg mb-4">Volume de Atendimentos (Últimos 7 dias)</h3>
        <div className="flex-1 min-h-[150px] relative">
          {!isDataLoaded ? (
             <div className="absolute inset-0 flex items-end justify-between px-4 pb-6 pt-4 animate-pulse">
                {Array.from({ length: 7 }).map((_, i) => (
                   <div key={i} className="w-10 bg-gray-200 rounded-t flex-shrink-0" style={{ height: `${Math.random() * 60 + 20}%`}}></div>
                ))}
             </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  cursor={{ fill: '#F3F4F6' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Consultas" stackId="a" fill="#0ea5e9" radius={[0, 0, 4, 4]} />
                <Bar dataKey="Exames" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Next Appointments Table */}
      <div className="md:col-span-12 md:row-span-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-gray-800 text-lg">Próximos Atendimentos (Hoje)</h3>
          <button onClick={() => navigate('/agendamentos')} className="text-primary-600 text-sm font-semibold hover:text-primary-700">Ver Agenda Completa</button>
        </div>
        <div className="overflow-y-auto flex-1 pr-2">
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-50 pb-2 block sm:table-row">
                <th className="pb-3 font-medium hidden sm:table-cell">Paciente</th>
                <th className="pb-3 font-medium hidden sm:table-cell">Médico / Setor</th>
                <th className="pb-3 font-medium hidden sm:table-cell">Horário</th>
                <th className="pb-3 font-medium hidden sm:table-cell">Status</th>
                <th className="pb-3 font-medium hidden sm:table-cell text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {!isDataLoaded ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50 last:border-0 block sm:table-row py-3 sm:py-0 animate-pulse">
                    <td className="py-3 block sm:table-cell">
                      <div className="h-4 bg-gray-200 rounded w-32 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-24"></div>
                    </td>
                    <td className="py-1 sm:py-3 text-gray-600 block sm:table-cell">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-16"></div>
                    </td>
                    <td className="py-1 sm:py-3 block sm:table-cell"><div className="h-4 bg-gray-200 rounded w-12"></div></td>
                    <td className="py-2 sm:py-3 block sm:table-cell"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
                    <td className="py-2 sm:py-3 block sm:table-cell text-right"><div className="h-6 bg-gray-200 rounded-lg w-8 ml-auto"></div></td>
                  </tr>
                ))
              ) : todayAppointments.length > 0 ? (
                todayAppointments.sort((a,b) => a.time.localeCompare(b.time)).slice(0, 5).map(app => {
                  const pt = patients.find(p => p.id === app.patientId);
                  const doc = doctors.find(d => d.id === app.doctorId);
                  return (
                    <tr key={app.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors block sm:table-row py-3 sm:py-0">
                      <td className="py-3 block sm:table-cell">
                        <p className="font-semibold text-gray-700">{pt?.name}</p>
                        <p className="text-xs text-gray-400 sm:mt-0.5">CPF: {pt?.cpf}</p>
                      </td>
                      <td className="py-1 sm:py-3 text-gray-600 block sm:table-cell">
                        {doc?.name} <br className="hidden sm:block" /> <span className="text-xs text-gray-400">{doc?.specialty}</span>
                      </td>
                      <td className="py-1 sm:py-3 font-mono font-medium text-gray-700 block sm:table-cell">{app.time}</td>
                      <td className="py-2 sm:py-3 block sm:table-cell">
                         <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-block ${
                            app.status === 'Concluído' ? 'bg-emerald-50 text-emerald-600' :
                            app.status === 'Cancelado' ? 'bg-gray-100 text-gray-400' :
                            'bg-primary-50 text-primary-600'
                         }`}>
                           {app.status}
                         </span>
                      </td>
                      <td className="py-2 sm:py-3 block sm:table-cell text-right">
                        {(app.status === 'Agendado' || app.status === 'Em Andamento') && (
                          <button
                            onClick={() => setCompleteModal({ isOpen: true, appt: app })}
                            className="text-emerald-600 hover:text-emerald-700 transition p-1.5 rounded-lg hover:bg-emerald-50"
                            title="Marcar como Concluído"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">Nenhum atendimento marcado para hoje.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <ConfirmModal
        isOpen={completeModal.isOpen}
        title="Concluir Atendimento"
        message="Tem certeza que deseja marcar este atendimento como Concluído?"
        confirmText="Sim, concluir"
        isDestructive={false}
        onConfirm={() => {
          if (completeModal.appt) {
            updateAppointment({ ...completeModal.appt, status: 'Concluído' });
          }
          setCompleteModal({ isOpen: false, appt: null });
        }}
        onClose={() => setCompleteModal({ isOpen: false, appt: null })}
      />
    </div>
  );
}
