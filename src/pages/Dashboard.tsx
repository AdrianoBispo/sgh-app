import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, CheckCircle, PackageCheck, ShieldCheck } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useToast } from '../components/ui/Toast';
import { Appointment, InventoryItem } from '../types';
import { STATUS_STYLES, canRecordCare } from '../lib/appointments';
import { InventorySummary, getStockHealth, summarizeInventory } from '../lib/inventory';
import { describeError } from '../lib/firebase-errors';
import { todayISO, toISODate } from '../lib/date';
import { cn } from '../lib/utils';

interface StatCardProps {
  label: string;
  value: number;
  footer: string;
  tone: 'primary' | 'amber' | 'blue';
  isLoading: boolean;
}

const TONES: Record<StatCardProps['tone'], { card: string; label: string; footer: string; skeleton: string }> = {
  primary: { card: 'bg-primary-600', label: 'text-primary-100', footer: 'bg-primary-700/50 text-primary-100', skeleton: 'bg-primary-500/50' },
  amber: { card: 'bg-amber-500', label: 'text-amber-100', footer: 'bg-amber-600/50 text-amber-50', skeleton: 'bg-amber-400/50' },
  blue: { card: 'bg-blue-500', label: 'text-blue-100', footer: 'bg-blue-600/50 text-blue-50', skeleton: 'bg-blue-400/50' },
};

function StatCard({ label, value, footer, tone, isLoading }: StatCardProps) {
  const styles = TONES[tone];
  return (
    <div className={cn('flex flex-col justify-between rounded-3xl p-6 text-white shadow-lg', styles.card)}>
      <div>
        <p className={cn('text-sm font-medium', styles.label)}>{label}</p>
        {isLoading ? (
          <div className={cn('mt-1 h-10 w-16 animate-pulse rounded', styles.skeleton)} />
        ) : (
          <h2 className="mt-1 text-4xl font-bold">{value}</h2>
        )}
      </div>
      <span className={cn('mt-4 max-w-fit rounded-xl p-2 text-sm font-medium', styles.footer)}>{footer}</span>
    </div>
  );
}

export function Dashboard() {
  const { patients, doctors, appointments, inventory, saveAppointment, isDataLoaded, currentUserRole } = useAppContext();
  const navigate = useNavigate();
  const toast = useToast();
  const [completeModal, setCompleteModal] = useState<{ isOpen: boolean; appointment: Appointment | null }>({
    isOpen: false,
    appointment: null,
  });
  const [isSaving, setIsSaving] = useState(false);

  const isPharmacy = currentUserRole === 'pharmacy';
  const canSeeStock = currentUserRole === 'admin' || currentUserRole === 'pharmacy';
  const canConclude = canRecordCare(currentUserRole);

  // `toISOString()` devolve a data em UTC: depois das 21h no Brasil a agenda
  // "de hoje" passava a mostrar o dia seguinte. `todayISO()` usa o fuso local.
  const today = todayISO();

  const todayAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.date === today).sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, today],
  );

  const counters = useMemo(
    () => ({
      total: todayAppointments.length,
      waiting: todayAppointments.filter((appointment) => appointment.status === 'Aguardando Atendimento').length,
      inProgress: todayAppointments.filter((appointment) => appointment.status === 'Em Andamento').length,
    }),
    [todayAppointments],
  );

  const stock = useMemo(() => summarizeInventory(inventory), [inventory]);
  const criticalItems = useMemo(
    () =>
      inventory
        .filter((item) => getStockHealth(item).needsAttention)
        .sort((a, b) => a.quantity - b.quantity)
        .slice(0, 4),
    [inventory],
  );

  const chartData = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, index) => {
        const day = subDays(new Date(), 6 - index);
        const isoDay = toISODate(day);
        const dayAppointments = appointments.filter((appointment) => appointment.date === isoDay);
        return {
          name: format(day, 'dd/MM', { locale: ptBR }),
          Consultas: dayAppointments.filter((appointment) => appointment.type === 'Consulta').length,
          Exames: dayAppointments.filter((appointment) => appointment.type === 'Exame').length,
        };
      }),
    [appointments],
  );

  const handleConclude = async () => {
    if (!completeModal.appointment) return;
    setIsSaving(true);
    try {
      await saveAppointment({ ...completeModal.appointment, status: 'Concluído' }, 'update');
      toast.success('Atendimento concluído.');
      setCompleteModal({ isOpen: false, appointment: null });
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível concluir o atendimento.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-3">
      <StatCard label="Agendamentos hoje" value={counters.total} footer="Agenda do dia" tone="primary" isLoading={!isDataLoaded} />
      <StatCard label="Aguardando atendimento" value={counters.waiting} footer="Recepção" tone="amber" isLoading={!isDataLoaded} />
      <StatCard label="Em andamento" value={counters.inProgress} footer="Consultórios" tone="blue" isLoading={!isDataLoaded} />

      <section className="flex min-h-[320px] flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:col-span-1">
        <h3 className="mb-4 text-lg font-bold text-gray-800">Volume (7 dias)</h3>
        <div className="relative min-h-[200px] flex-1">
          {!isDataLoaded ? (
            <div className="absolute inset-0 flex animate-pulse items-end justify-between px-4 pb-6 pt-4">
              {[45, 70, 30, 85, 55, 40, 65].map((height, index) => (
                <div key={index} className="w-6 shrink-0 rounded-t bg-gray-200" style={{ height: `${height}%` }} />
              ))}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} width={30} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  cursor={{ fill: '#F3F4F6' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Bar dataKey="Consultas" stackId="a" fill="#0ea5e9" radius={[0, 0, 4, 4]} />
                <Bar dataKey="Exames" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {isPharmacy ? (
        <StockPanel
          isLoading={!isDataLoaded}
          summary={stock}
          items={criticalItems}
          onOpen={() => navigate('/estoque')}
          className="md:col-span-2"
        />
      ) : (
        <section className="flex min-h-[320px] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:col-span-2">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-gray-800">Próximos atendimentos (hoje)</h3>
            <button
              type="button"
              onClick={() => navigate('/agendamentos')}
              className="text-sm font-semibold text-primary-600 transition hover:text-primary-700"
            >
              Ver agenda completa
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400">
                  <th className="pb-3 font-medium">Paciente</th>
                  <th className="hidden pb-3 font-medium sm:table-cell">Profissional</th>
                  <th className="pb-3 font-medium">Horário</th>
                  <th className="pb-3 font-medium">Status</th>
                  {canConclude && <th className="pb-3 text-right font-medium">Ação</th>}
                </tr>
              </thead>
              <tbody className="text-sm">
                {!isDataLoaded ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <tr key={index} className="animate-pulse border-b border-gray-50 last:border-0">
                      <td className="py-3">
                        <div className="mb-1 h-4 w-32 rounded bg-gray-200" />
                        <div className="h-3 w-24 rounded bg-gray-200" />
                      </td>
                      <td className="hidden py-3 sm:table-cell">
                        <div className="h-4 w-24 rounded bg-gray-200" />
                      </td>
                      <td className="py-3">
                        <div className="h-4 w-12 rounded bg-gray-200" />
                      </td>
                      <td className="py-3">
                        <div className="h-6 w-20 rounded-full bg-gray-200" />
                      </td>
                      {canConclude && <td className="py-3" />}
                    </tr>
                  ))
                ) : todayAppointments.length > 0 ? (
                  todayAppointments.slice(0, 6).map((appointment) => {
                    const patient = patients.find((item) => item.id === appointment.patientId);
                    const doctor = doctors.find((item) => item.id === appointment.doctorId);
                    const isOpen = appointment.status !== 'Concluído' && appointment.status !== 'Cancelado' && appointment.status !== 'Faltou';

                    return (
                      <tr key={appointment.id} className="border-b border-gray-50 transition-colors last:border-0 hover:bg-gray-50">
                        <td className="py-3">
                          <p className="font-semibold text-gray-700">{patient?.name ?? 'Paciente removido'}</p>
                          <p className="text-xs text-gray-400">{patient?.cpf ?? '—'}</p>
                        </td>
                        <td className="hidden py-3 text-gray-600 sm:table-cell">
                          {doctor?.name ?? 'Profissional removido'}
                          <span className="block text-xs text-gray-400">{doctor?.specialty}</span>
                        </td>
                        <td className="py-3 font-mono font-medium text-gray-700">{appointment.time}</td>
                        <td className="py-3">
                          <span className={cn('inline-block rounded-full px-3 py-1 text-xs font-semibold', STATUS_STYLES[appointment.status])}>
                            {appointment.status}
                          </span>
                        </td>
                        {canConclude && (
                          <td className="py-3 text-right">
                            {isOpen && (
                              <button
                                type="button"
                                onClick={() => setCompleteModal({ isOpen: true, appointment })}
                                className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-700"
                                title={`Concluir atendimento de ${patient?.name ?? 'paciente'}`}
                              >
                                <CheckCircle className="h-5 w-5" aria-hidden="true" />
                                <span className="sr-only">Concluir atendimento</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={canConclude ? 5 : 4} className="py-8 text-center text-gray-500">
                      Nenhum atendimento marcado para hoje.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {canSeeStock && !isPharmacy && (
        <StockPanel
          isLoading={!isDataLoaded}
          summary={stock}
          items={criticalItems}
          onOpen={() => navigate('/estoque')}
          className="md:col-span-3"
        />
      )}

      <ConfirmModal
        isOpen={completeModal.isOpen}
        title="Concluir atendimento"
        message="Tem certeza que deseja marcar este atendimento como concluído?"
        confirmText="Sim, concluir"
        isDestructive={false}
        isLoading={isSaving}
        onConfirm={handleConclude}
        onClose={() => setCompleteModal({ isOpen: false, appointment: null })}
      />
    </div>
  );
}

interface StockPanelProps {
  isLoading: boolean;
  summary: InventorySummary;
  items: InventoryItem[];
  onOpen: () => void;
  className?: string;
}

/**
 * Painel de alerta do estoque — previsto na documentação de testes
 * (CT03.01/CT03.02) mas ausente da tela até aqui.
 */
function StockPanel({ isLoading, summary, items, onOpen, className }: StockPanelProps) {
  const hasAlert = summary.attention > 0;

  return (
    <section className={cn('flex flex-col rounded-3xl border border-gray-200 bg-white p-6 shadow-sm', className)}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-gray-800">Estoque</h3>
        <button type="button" onClick={onOpen} className="text-sm font-semibold text-primary-600 transition hover:text-primary-700">
          Abrir farmácia
        </button>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
      ) : hasAlert ? (
        <>
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
            <div>
              <p className="font-semibold text-amber-900">Alerta de estoque crítico</p>
              <p className="text-sm text-amber-800">
                {summary.out > 0 && `${summary.out} sem saldo · `}
                {summary.low > 0 && `${summary.low} abaixo do mínimo · `}
                {summary.expired > 0 && `${summary.expired} vencido(s) · `}
                {summary.expiring > 0 && `${summary.expiring} a vencer em 30 dias`}
              </p>
            </div>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => {
              const health = getStockHealth(item);
              return (
                <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-700">{item.name}</span>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', health.expiry === 'expired' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                    {health.expiry === 'expired'
                      ? 'Vencido'
                      : health.expiry === 'expiring'
                        ? `Vence em ${health.daysToExpiry}d`
                        : `${item.quantity}/${item.minQuantity}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="font-semibold text-emerald-900">Estoque dentro da margem</p>
            <p className="text-sm text-emerald-800">
              {summary.total > 0 ? `${summary.total} lote(s) ativo(s) sem pendências.` : 'Nenhum lote ativo cadastrado.'}
            </p>
          </div>
        </div>
      )}

      {!isLoading && summary.total > 0 && (
        <p className="mt-4 flex items-center gap-2 text-xs text-gray-400">
          <PackageCheck className="h-4 w-4" aria-hidden="true" />
          Alerta considera saldo mínimo e validade em até 30 dias.
        </p>
      )}
    </section>
  );
}
