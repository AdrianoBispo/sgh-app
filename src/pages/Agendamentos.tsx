import { FormEvent, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Edit2,
  FileText,
  LayoutList,
  Plus,
  Search,
  XCircle,
} from 'lucide-react';
import { addDays, format, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAppContext } from '../context/AppContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ImportExportButtons } from '../components/ui/ImportExportButtons';
import { useToast } from '../components/ui/Toast';
import { Appointment, AppointmentStatus, Doctor, Patient } from '../types';
import {
  STATUS_STYLES,
  allowedStatusesFor,
  canManageSchedule,
  canRecordCare,
  coerceStatus,
  findScheduleConflict,
  isValidTime,
} from '../lib/appointments';
import { generateDocumentPDF, DocumentType, DOCUMENT_TYPES } from '../lib/pdf';
import { SpreadsheetRow, readField } from '../lib/spreadsheet';
import { describeError } from '../lib/firebase-errors';
import { formatDateBR, parseISODate, toISODate, todayISO } from '../lib/date';
import { generateId, sanitizeId } from '../lib/id';
import { cn } from '../lib/utils';

/** Faixa padrão exibida no calendário; expande conforme os agendamentos. */
const DEFAULT_FIRST_HOUR = 7;
const DEFAULT_LAST_HOUR = 19;

const DOCUMENT_STYLES: Record<DocumentType, { badge: string; hint: string }> = {
  Comprovante: { badge: 'bg-slate-100 text-slate-600', hint: 'Comprovante de agendamento para o paciente.' },
  Atestado: { badge: 'bg-blue-100 text-blue-600', hint: 'Atestado de comparecimento ou repouso, com CID-10 quando informado.' },
  'Receituário': { badge: 'bg-emerald-100 text-emerald-600', hint: 'Prescrição de medicamentos.' },
  Encaminhamento: { badge: 'bg-purple-100 text-purple-600', hint: 'Solicitação de exames ou encaminhamento a especialista.' },
};

export function Agendamentos() {
  const { appointments, saveAppointment, patients, doctors, currentUserRole, isDataLoaded } = useAppContext();
  const toast = useToast();

  const [filterDate, setFilterDate] = useState(todayISO());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [cancelModal, setCancelModal] = useState<{ isOpen: boolean; appointment: Appointment | null }>({ isOpen: false, appointment: null });
  const [cancelReason, setCancelReason] = useState('');
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [docModal, setDocModal] = useState<{ isOpen: boolean; appointment: Appointment | null }>({ isOpen: false, appointment: null });
  const [isSaving, setIsSaving] = useState(false);

  const canSchedule = canManageSchedule(currentUserRole);
  const canCare = canRecordCare(currentUserRole);
  const isEditing = Boolean(editingAppt?.id);

  const matchesSearch = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return () => true;
    return (appointment: Appointment) => {
      const patient = patients.find((item) => item.id === appointment.patientId);
      const doctor = doctors.find((item) => item.id === appointment.doctorId);
      return Boolean(patient?.name.toLowerCase().includes(term) || doctor?.name.toLowerCase().includes(term));
    };
  }, [searchTerm, patients, doctors]);

  const filteredAppointments = useMemo(
    () =>
      appointments
        .filter((appointment) => appointment.date === filterDate)
        .filter(matchesSearch)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [appointments, filterDate, matchesSearch],
  );

  const { displayedItems, loadMoreRef, hasMore } = useInfiniteScroll(filteredAppointments, 15, `${filterDate}|${searchTerm}`);

  const weekDays = useMemo(() => {
    const reference = parseISODate(filterDate) ?? new Date();
    const firstDay = startOfWeek(reference, { weekStartsOn: 1 });
    return Array.from({ length: 7 }).map((_, index) => addDays(firstDay, index));
  }, [filterDate]);

  /** Mostra também os horários fora do expediente padrão que já têm agenda. */
  const calendarHours = useMemo(() => {
    const isoDays = new Set(weekDays.map(toISODate));
    const hours = new Set<number>();
    for (let hour = DEFAULT_FIRST_HOUR; hour <= DEFAULT_LAST_HOUR; hour++) hours.add(hour);
    for (const appointment of appointments) {
      if (!isoDays.has(appointment.date)) continue;
      const hour = Number(appointment.time.slice(0, 2));
      if (Number.isFinite(hour)) hours.add(hour);
    }
    return Array.from(hours).sort((a, b) => a - b);
  }, [appointments, weekDays]);

  const shiftWeek = (weeks: number) => {
    const reference = parseISODate(filterDate) ?? new Date();
    setFilterDate(toISODate(addDays(reference, weeks * 7)));
  };

  const describeConflict = (doctorId: string, date: string, time: string) => {
    const doctor = doctors.find((item) => item.id === doctorId);
    return `${doctor?.name || 'O profissional'} já possui um agendamento às ${time} em ${formatDateBR(date)}.`;
  };

  const handleFormChange = (event: FormEvent<HTMLFormElement>) => {
    const formData = new FormData(event.currentTarget);
    const date = String(formData.get('date') ?? editingAppt?.date ?? '');
    const time = String(formData.get('time') ?? editingAppt?.time ?? '');
    const doctorId = String(formData.get('doctorId') ?? editingAppt?.doctorId ?? '');

    const conflict = date && time && doctorId
      ? findScheduleConflict(appointments, { doctorId, date, time, ignoreId: editingAppt?.id })
      : undefined;

    setConflictError(conflict ? describeConflict(doctorId, date, time) : null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const existing = isEditing ? editingAppt : null;

    /**
     * Campos desabilitados não entram no `FormData`. A versão anterior lia
     * tudo do formulário, então um médico que apenas mudasse o status gravava
     * `patientId`, `date` e `time` vazios — o agendamento era destruído.
     * Cada campo agora cai de volta no valor já persistido.
     */
    const patientId = String(formData.get('patientId') ?? '') || existing?.patientId || '';
    const doctorId = String(formData.get('doctorId') ?? '') || existing?.doctorId || '';
    const date = String(formData.get('date') ?? '') || existing?.date || '';
    const time = String(formData.get('time') ?? '') || existing?.time || '';
    const type = (String(formData.get('type') ?? '') || existing?.type || 'Consulta') as Appointment['type'];

    if (!patientId || !doctorId || !date || !time) {
      toast.error('Preencha paciente, profissional, data e horário.');
      return;
    }
    if (!isValidTime(time)) {
      toast.error('Horário inválido.');
      return;
    }

    const conflict = findScheduleConflict(appointments, { doctorId, date, time, ignoreId: existing?.id });
    if (conflict) {
      setConflictError(describeConflict(doctorId, date, time));
      return;
    }
    setConflictError(null);

    const statusField = formData.get('status');
    const status: AppointmentStatus = statusField ? coerceStatus(statusField, existing?.status) : (existing?.status ?? 'Agendado');

    const appointment: Appointment = {
      id: existing?.id || generateId(),
      patientId,
      doctorId,
      type,
      date,
      time,
      status,
      notes: String(formData.get('notes') ?? existing?.notes ?? '').trim(),
      // O CID-10 tinha campo no formulário mas nunca era incluído no payload:
      // o que o médico digitava era descartado ao salvar.
      cid10: String(formData.get('cid10') ?? existing?.cid10 ?? '').trim() || undefined,
    };

    setIsSaving(true);
    try {
      await saveAppointment(appointment, existing ? 'update' : 'create');
      toast.success(existing ? 'Agendamento atualizado.' : 'Agendamento criado.');
      setIsModalOpen(false);
      setEditingAppt(null);
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível salvar o agendamento.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    const appointment = cancelModal.appointment;
    if (!appointment || !cancelReason.trim()) return;

    setIsSaving(true);
    try {
      await saveAppointment(
        {
          ...appointment,
          status: 'Cancelado',
          notes: `${appointment.notes || ''}\nCancelado: ${cancelReason.trim()}`.trim(),
        },
        'update',
      );
      toast.success('Agendamento cancelado.');
      setCancelModal({ isOpen: false, appointment: null });
      setCancelReason('');
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível cancelar o agendamento.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDropAppointment = async (appointment: Appointment, newDate: string, newTime: string) => {
    if (!canSchedule || (appointment.date === newDate && appointment.time === newTime)) return;

    const conflict = findScheduleConflict(appointments, {
      doctorId: appointment.doctorId,
      date: newDate,
      time: newTime,
      ignoreId: appointment.id,
    });
    if (conflict) {
      toast.error(describeConflict(appointment.doctorId, newDate, newTime));
      return;
    }

    try {
      await saveAppointment({ ...appointment, date: newDate, time: newTime }, 'update');
      toast.success(`Reagendado para ${formatDateBR(newDate)} às ${newTime}.`);
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível reagendar.'));
    }
  };

  const handleImport = async (rows: SpreadsheetRow[]) => {
    let imported = 0;
    const problems: string[] = [];

    /** Aceita o ID, o CPF ou o nome do paciente/profissional na planilha. */
    const resolvePatient = (value: string): Patient | undefined => {
      const normalized = value.trim().toLowerCase();
      return patients.find(
        (patient) =>
          patient.id === value ||
          patient.cpf.replace(/\D/g, '') === value.replace(/\D/g, '') ||
          patient.name.toLowerCase() === normalized,
      );
    };
    const resolveDoctor = (value: string): Doctor | undefined => {
      const normalized = value.trim().toLowerCase();
      return doctors.find((doctor) => doctor.id === value || doctor.crm === value || doctor.name.toLowerCase() === normalized);
    };

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const patient = resolvePatient(readField(row, 'patientId', 'paciente', 'cpf'));
      const doctor = resolveDoctor(readField(row, 'doctorId', 'profissional', 'medico', 'crm'));
      const date = readField(row, 'date', 'data');
      const time = readField(row, 'time', 'hora', 'horario');

      if (!patient || !doctor) {
        problems.push(`Linha ${line}: paciente ou profissional não encontrado no cadastro.`);
        continue;
      }
      if (!parseISODate(date) || !isValidTime(time)) {
        problems.push(`Linha ${line}: data (AAAA-MM-DD) ou hora (HH:MM) inválida.`);
        continue;
      }
      if (findScheduleConflict(appointments, { doctorId: doctor.id, date, time })) {
        problems.push(`Linha ${line}: conflito de horário para ${doctor.name}.`);
        continue;
      }

      const appointment: Appointment = {
        id: sanitizeId(readField(row, 'id')) ?? generateId(),
        patientId: patient.id,
        doctorId: doctor.id,
        type: readField(row, 'type', 'tipo') === 'Exame' ? 'Exame' : 'Consulta',
        date,
        time,
        status: coerceStatus(readField(row, 'status')),
        notes: readField(row, 'notes', 'observacoes'),
      };

      try {
        await saveAppointment(appointment, 'create');
        imported++;
      } catch (error) {
        problems.push(`Linha ${line}: ${describeError(error, 'falha ao gravar.')}`);
      }
    }

    if (imported > 0) toast.success(`${imported} agendamento(s) importado(s).`);
    if (problems.length > 0) {
      toast.warning(`${problems.length} linha(s) ignorada(s). ${problems.slice(0, 2).join(' ')}`);
      console.warn('Importação de agendamentos:', problems);
    }
  };

  const openNew = (date?: string, time?: string) => {
    if (!canSchedule) return;
    setEditingAppt(
      date
        ? { id: '', patientId: '', doctorId: '', type: 'Consulta', date, time: time ?? '08:00', status: 'Agendado', notes: '' }
        : null,
    );
    setConflictError(null);
    setIsModalOpen(true);
  };

  const openExisting = (appointment: Appointment) => {
    setEditingAppt(appointment);
    setConflictError(null);
    setIsModalOpen(true);
  };

  const statusOptions = allowedStatusesFor(currentUserRole, editingAppt?.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex w-full items-center gap-3 sm:w-auto">
          <ImportExportButtons onImport={handleImport} exportData={appointments} exportFileName="agendamentos" canImport={canSchedule} />
          {canSchedule && (
            <button
              type="button"
              onClick={() => openNew()}
              className="flex items-center whitespace-nowrap rounded-xl bg-gray-900 px-4 py-2.5 font-medium text-white transition hover:bg-gray-800"
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Novo agendamento
            </button>
          )}
        </div>

        <div className="flex items-center rounded-xl bg-gray-100 p-1" role="group" aria-label="Modo de visualização">
          {(['list', 'calendar'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              aria-pressed={viewMode === mode}
              className={cn(
                'flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition',
                viewMode === mode ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
              )}
            >
              {mode === 'list' ? (
                <><LayoutList className="mr-1.5 h-4 w-4" aria-hidden="true" /> Lista</>
              ) : (
                <><CalendarIcon className="mr-1.5 h-4 w-4" aria-hidden="true" /> Calendário</>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 p-6">
          <div className="flex items-center gap-2">
            {viewMode === 'calendar' && (
              <button type="button" onClick={() => shiftWeek(-1)} aria-label="Semana anterior" className="rounded-lg border border-gray-300 p-1.5 text-gray-600 transition hover:bg-gray-50">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <label htmlFor="filter-date" className="whitespace-nowrap text-sm font-medium text-gray-700">
              {viewMode === 'calendar' ? 'Semana de:' : 'Data:'}
            </label>
            <input
              id="filter-date"
              type="date"
              className="rounded-lg border border-gray-300 px-3 py-1.5 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value || todayISO())}
            />
            {viewMode === 'calendar' && (
              <button type="button" onClick={() => shiftWeek(1)} aria-label="Próxima semana" className="rounded-lg border border-gray-300 p-1.5 text-gray-600 transition hover:bg-gray-50">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
            <button type="button" onClick={() => setFilterDate(todayISO())} className="rounded-lg px-2 py-1.5 text-sm font-medium text-primary-600 transition hover:bg-primary-50">
              Hoje
            </button>
          </div>

          <div className="relative ml-auto w-full max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar por paciente ou profissional"
              placeholder="Buscar por paciente ou profissional..."
              className="w-full rounded-lg border border-gray-300 py-1.5 pl-9 pr-3 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        {viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left text-sm">
              <thead className="bg-gray-50 font-medium text-gray-600">
                <tr>
                  <th scope="col" className="px-6 py-3">Horário</th>
                  <th scope="col" className="px-6 py-3">Paciente</th>
                  <th scope="col" className="px-6 py-3">Profissional</th>
                  <th scope="col" className="px-6 py-3">Tipo</th>
                  <th scope="col" className="px-6 py-3">Status</th>
                  <th scope="col" className="px-6 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-gray-800">
                {!isDataLoaded ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      {Array.from({ length: 6 }).map((__, cell) => (
                        <td key={cell} className="px-6 py-4"><div className="h-4 w-20 rounded bg-gray-200" /></td>
                      ))}
                    </tr>
                  ))
                ) : displayedItems.length > 0 ? (
                  displayedItems.map((appointment) => {
                    const patient = patients.find((item) => item.id === appointment.patientId);
                    const doctor = doctors.find((item) => item.id === appointment.doctorId);
                    const isOpen = appointment.status !== 'Concluído' && appointment.status !== 'Cancelado';

                    return (
                      <tr key={appointment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-mono font-semibold">{appointment.time}</td>
                        <td className="px-6 py-4">{patient?.name || 'Paciente removido'}</td>
                        <td className="px-6 py-4">{doctor?.name || 'Profissional removido'}</td>
                        <td className="px-6 py-4">{appointment.type}</td>
                        <td className="px-6 py-4">
                          <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', STATUS_STYLES[appointment.status])}>
                            {appointment.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openExisting(appointment)}
                              className="text-primary-600 transition hover:text-primary-800"
                              title="Ver detalhes / editar"
                            >
                              <Edit2 className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only">Ver detalhes</span>
                            </button>
                            {(canSchedule || canCare) && patient && (
                              <button
                                type="button"
                                onClick={() => setDocModal({ isOpen: true, appointment })}
                                className="text-gray-400 transition hover:text-blue-600"
                                title="Emitir documento"
                              >
                                <FileText className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Emitir documento</span>
                              </button>
                            )}
                            {canSchedule && isOpen && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelReason('');
                                  setCancelModal({ isOpen: true, appointment });
                                }}
                                className="text-gray-400 transition hover:text-rose-600"
                                title="Cancelar agendamento"
                              >
                                <XCircle className="h-4 w-4" aria-hidden="true" />
                                <span className="sr-only">Cancelar</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      Nenhum agendamento para {formatDateBR(filterDate)}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {hasMore && (
              <div ref={loadMoreRef} className="flex h-10 items-center justify-center text-sm text-gray-400">
                Carregando mais...
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto bg-gray-50 p-4">
            <div className="relative min-w-[900px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              {!isDataLoaded && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-[1px]">
                  <span className="animate-pulse font-medium text-gray-500">Carregando calendário...</span>
                </div>
              )}

              <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50">
                <div className="border-r border-gray-200 p-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Hora
                </div>
                {weekDays.map((day) => {
                  const isToday = toISODate(day) === todayISO();
                  return (
                    <div key={day.toISOString()} className={cn('border-r border-gray-200 p-3 text-center last:border-r-0', isToday && 'bg-primary-50/60')}>
                      <div className={cn('text-xs font-semibold uppercase', isToday ? 'text-primary-700' : 'text-gray-500')}>
                        {format(day, 'EEEE', { locale: ptBR }).split('-')[0]}
                      </div>
                      <div className={cn('mt-0.5 text-lg font-bold', isToday ? 'text-primary-700' : 'text-gray-900')}>
                        {format(day, 'dd/MM')}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col">
                {calendarHours.map((hour) => {
                  const hourLabel = `${String(hour).padStart(2, '0')}:00`;
                  const hourPrefix = String(hour).padStart(2, '0');

                  return (
                    <div key={hour} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-gray-100 last:border-b-0">
                      <div className="border-r border-gray-200 bg-gray-50/50 p-3 text-center text-xs font-medium text-gray-400">
                        {hourLabel}
                      </div>
                      {weekDays.map((day) => {
                        const isoDay = toISODate(day);
                        const isToday = isoDay === todayISO();
                        const cellAppointments = appointments.filter(
                          (appointment) =>
                            appointment.date === isoDay &&
                            appointment.time.slice(0, 2) === hourPrefix &&
                            appointment.status !== 'Cancelado' &&
                            matchesSearch(appointment),
                        );

                        return (
                          <div
                            key={isoDay}
                            onClick={() => openNew(isoDay, `${hourPrefix}:00`)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault();
                              const id = event.dataTransfer.getData('text/plain');
                              const dropped = appointments.find((appointment) => appointment.id === id);
                              if (dropped) void handleDropAppointment(dropped, isoDay, `${hourPrefix}:00`);
                            }}
                            className={cn(
                              'relative flex min-h-[90px] flex-col gap-1.5 border-r border-gray-100 p-1.5 transition last:border-r-0 hover:bg-gray-50/70',
                              canSchedule && 'cursor-crosshair',
                              isToday && 'bg-primary-50/20',
                            )}
                          >
                            {cellAppointments.map((appointment) => {
                              const patientName = patients.find((item) => item.id === appointment.patientId)?.name || 'Paciente';
                              const doctor = doctors.find((item) => item.id === appointment.doctorId);
                              return (
                                <button
                                  key={appointment.id}
                                  type="button"
                                  draggable={canSchedule}
                                  onDragStart={(event) => event.dataTransfer.setData('text/plain', appointment.id)}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openExisting(appointment);
                                  }}
                                  title={`${appointment.time} · ${patientName} · ${doctor?.name || '-'} · ${appointment.status}`}
                                  className={cn(
                                    'w-full rounded-md border p-1.5 text-left text-xs shadow-sm transition',
                                    canSchedule && 'hover:cursor-grab active:cursor-grabbing',
                                    appointment.type === 'Consulta'
                                      ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                                  )}
                                >
                                  <span className="block truncate font-semibold leading-tight">
                                    {appointment.time} · {patientName}
                                  </span>
                                  <span className="block truncate text-[10px] leading-tight opacity-80">{doctor?.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditing ? 'Gerenciar agendamento' : 'Novo agendamento'}
        description={isEditing ? 'O paciente do agendamento não pode ser alterado. Cancele e reagende se necessário.' : undefined}
      >
        <form onSubmit={handleSave} onChange={handleFormChange} className="space-y-4">
          {conflictError && (
            <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" aria-hidden="true" />
              <div>
                <p className="font-semibold text-red-800">Conflito de horário</p>
                <p>{conflictError}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="appt-patient" className="mb-1 block text-sm font-medium text-gray-700">Paciente</label>
              <select
                id="appt-patient"
                required={!isEditing}
                name="patientId"
                defaultValue={editingAppt?.patientId || ''}
                disabled={!canSchedule || isEditing}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
              >
                <option value="">Selecione...</option>
                {patients
                  .filter((patient) => patient.status === 'active' || patient.id === editingAppt?.patientId)
                  .map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.name} — {patient.cpf}
                    </option>
                  ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="appt-doctor" className="mb-1 block text-sm font-medium text-gray-700">Profissional</label>
              <select
                id="appt-doctor"
                required
                name="doctorId"
                defaultValue={editingAppt?.doctorId || ''}
                disabled={!canSchedule}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
              >
                <option value="">Selecione...</option>
                {doctors
                  .filter((doctor) => doctor.status === 'active' || doctor.id === editingAppt?.doctorId)
                  .map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name} ({doctor.specialty})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label htmlFor="appt-type" className="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
              <select
                id="appt-type"
                name="type"
                defaultValue={editingAppt?.type || 'Consulta'}
                disabled={!canSchedule}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
              >
                <option value="Consulta">Consulta</option>
                <option value="Exame">Exame</option>
              </select>
            </div>

            {isEditing && statusOptions.length > 0 && (
              <div>
                <label htmlFor="appt-status" className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                <select
                  id="appt-status"
                  name="status"
                  defaultValue={editingAppt?.status}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="appt-date" className="mb-1 block text-sm font-medium text-gray-700">Data</label>
              <input
                id="appt-date"
                required
                type="date"
                name="date"
                defaultValue={editingAppt?.date || filterDate}
                disabled={!canSchedule}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
              />
            </div>

            <div>
              <label htmlFor="appt-time" className="mb-1 block text-sm font-medium text-gray-700">Horário</label>
              <input
                id="appt-time"
                required
                type="time"
                name="time"
                defaultValue={editingAppt?.time}
                disabled={!canSchedule}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
              />
            </div>

            <div className="md:col-span-2">
              <label htmlFor="appt-notes" className="mb-1 block text-sm font-medium text-gray-700">Observações</label>
              <textarea
                id="appt-notes"
                name="notes"
                defaultValue={editingAppt?.notes}
                rows={3}
                disabled={!canSchedule && !canCare}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50"
              />
            </div>

            {isEditing && canCare && (
              <div className="md:col-span-2">
                <label htmlFor="appt-cid" className="mb-1 block text-sm font-medium text-gray-700">CID-10 (opcional)</label>
                <input
                  id="appt-cid"
                  type="text"
                  name="cid10"
                  defaultValue={editingAppt?.cid10}
                  placeholder="Ex.: J01.9, I10"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 uppercase focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200">
              {canSchedule || canCare ? 'Cancelar' : 'Fechar'}
            </button>
            {(canSchedule || (canCare && isEditing)) && (
              <button
                type="submit"
                disabled={Boolean(conflictError) || isSaving}
                className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal({ isOpen: false, appointment: null })}
        onConfirm={handleCancel}
        isLoading={isSaving}
        title="Cancelar agendamento"
        message={
          <div className="flex w-full flex-col space-y-4">
            <p>Tem certeza que deseja cancelar este agendamento? O horário volta a ficar disponível.</p>
            <div className="flex flex-col">
              <label htmlFor="cancel-reason" className="mb-1 text-sm font-semibold text-gray-700">
                Motivo do cancelamento <span className="text-red-500">*</span>
              </label>
              <textarea
                id="cancel-reason"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500"
                rows={3}
                placeholder="Informe o motivo para registro..."
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
              />
              {!cancelReason.trim() && <p className="mt-1 text-xs text-rose-500">O motivo é obrigatório.</p>}
            </div>
          </div>
        }
        confirmText="Confirmar cancelamento"
        confirmDisabled={!cancelReason.trim()}
      />

      <Modal
        isOpen={docModal.isOpen}
        onClose={() => setDocModal({ isOpen: false, appointment: null })}
        title="Emitir documento"
        description="Selecione o tipo de documento a gerar em PDF."
      >
        <div className="grid grid-cols-1 gap-3">
          {DOCUMENT_TYPES.map((docType) => (
            <button
              key={docType}
              type="button"
              onClick={async () => {
                const appointment = docModal.appointment;
                const patient = patients.find((item) => item.id === appointment?.patientId);
                const doctor = doctors.find((item) => item.id === appointment?.doctorId);
                if (!appointment || !patient) {
                  toast.error('Paciente não encontrado para este agendamento.');
                  return;
                }
                try {
                  await generateDocumentPDF(patient, appointment, doctor, docType);
                  setDocModal({ isOpen: false, appointment: null });
                } catch (error) {
                  toast.error(describeError(error, 'Não foi possível gerar o documento.'));
                }
              }}
              className="flex items-center gap-4 rounded-xl border border-gray-200 p-4 text-left transition hover:border-primary-500 hover:bg-primary-50"
            >
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', DOCUMENT_STYLES[docType].badge)}>
                <FileText className="h-5 w-5" aria-hidden="true" />
              </span>
              <span>
                <span className="block font-bold text-gray-800">{docType}</span>
                <span className="mt-1 block text-xs text-gray-500">{DOCUMENT_STYLES[docType].hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
