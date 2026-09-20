import { FormEvent, useMemo, useState } from 'react';
import { Ban, Calendar as CalendarIcon, CheckCircle, Download, Edit2, FileOutput, FileText, Plus, Search, User } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ImportExportButtons } from '../components/ui/ImportExportButtons';
import { useToast } from '../components/ui/Toast';
import { Patient } from '../types';
import { formatCPF, onlyDigits, validateBirthDate, validateCPF } from '../lib/validators';
import { generatePatientSummaryPDF, generateDocumentPDF } from '../lib/pdf';
import { SpreadsheetRow, readField } from '../lib/spreadsheet';
import { describeError } from '../lib/firebase-errors';
import { ageFromBirthDate, dateTimeValue, formatDateBR, todayISO } from '../lib/date';
import { STATUS_STYLES } from '../lib/appointments';
import { generateId, sanitizeId } from '../lib/id';
import { cn } from '../lib/utils';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const DOCUMENT_TYPES = ['Comprovante', 'Atestado', 'Receituário', 'Encaminhamento'] as const;

/** Remove acentos para que "Joao" encontre "João". */
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function Pacientes() {
  const { patients, savePatient, currentUserRole, isDataLoaded, appointments, doctors, recordAudit } = useAppContext();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; patient: Patient | null }>({ isOpen: false, patient: null });
  const [summaryPatient, setSummaryPatient] = useState<Patient | null>(null);
  const [activeSummaryTab, setActiveSummaryTab] = useState<'dados' | 'historico'>('dados');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [cpfValue, setCpfValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const canEdit = currentUserRole === 'admin' || currentUserRole === 'reception';

  const filteredPatients = useMemo(() => {
    const term = normalize(searchTerm.trim());
    const digits = onlyDigits(searchTerm);
    return patients
      .filter((patient) => {
        const matchesSearch =
          !term || normalize(patient.name).includes(term) || (digits.length > 0 && onlyDigits(patient.cpf).includes(digits));
        const matchesStatus = statusFilter === 'all' || patient.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [patients, searchTerm, statusFilter]);

  const { displayedItems, loadMoreRef, hasMore } = useInfiniteScroll(filteredPatients, 15, `${searchTerm}|${statusFilter}`);

  const openCreateModal = () => {
    setEditingPatient(null);
    setCpfValue('');
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (patient: Patient) => {
    setEditingPatient(patient);
    setCpfValue(patient.cpf);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // CPF e data de nascimento são imutáveis após o cadastro (as regras do
    // Firestore rejeitam a alteração), por isso os campos ficam desabilitados
    // na edição e os valores originais são reaproveitados aqui.
    const cpf = editingPatient ? editingPatient.cpf : cpfValue.trim();
    const birthDate = editingPatient ? editingPatient.birthDate : String(formData.get('birthDate') ?? '');
    const name = String(formData.get('name') ?? '').trim();

    const errors: Record<string, string> = {};
    if (!name) errors.name = 'Informe o nome completo.';
    if (!validateCPF(cpf)) errors.cpf = 'CPF inválido. Use o formato XXX.XXX.XXX-XX e confira os dígitos.';
    if (!validateBirthDate(birthDate)) errors.birthDate = 'Data de nascimento inválida.';

    const duplicate = patients.find(
      (patient) => onlyDigits(patient.cpf) === onlyDigits(cpf) && patient.id !== editingPatient?.id,
    );
    if (!errors.cpf && duplicate) errors.cpf = `Já existe um paciente com este CPF (${duplicate.name}).`;

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    const patient: Patient = {
      id: editingPatient?.id ?? generateId(),
      name,
      cpf,
      birthDate,
      contact: String(formData.get('contact') ?? '').trim(),
      bloodType: String(formData.get('bloodType') ?? ''),
      description: String(formData.get('description') ?? '').trim(),
      status: (formData.get('status') as Patient['status']) || 'active',
    };

    setIsSaving(true);
    try {
      await savePatient(patient, editingPatient ? 'update' : 'create');

      await recordAudit({
        action: editingPatient ? 'Edição de Perfil (Paciente)' : 'Cadastro de Paciente',
        entityType: 'Paciente',
        entityId: patient.id,
        entityName: patient.name,
        details: editingPatient ? `Atualizou os dados de ${patient.name}` : `Cadastrou o paciente ${patient.name}`,
        beforeData: editingPatient ?? undefined,
        afterData: patient,
      });

      toast.success(editingPatient ? 'Paciente atualizado.' : 'Paciente cadastrado.');
      setIsModalOpen(false);
      setEditingPatient(null);
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível salvar o paciente.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    const patient = confirmModal.patient;
    if (!patient) return;

    const newStatus = patient.status === 'active' ? 'inactive' : 'active';
    setIsSaving(true);
    try {
      await savePatient({ ...patient, status: newStatus }, 'update');
      await recordAudit({
        action: newStatus === 'inactive' ? 'Exclusão Lógica (Paciente)' : 'Reativação de Paciente',
        entityType: 'Paciente',
        entityId: patient.id,
        entityName: patient.name,
        details: `${newStatus === 'inactive' ? 'Desativou' : 'Reativou'} o paciente ${patient.name}`,
        beforeData: patient,
        afterData: { ...patient, status: newStatus },
      });
      toast.success(newStatus === 'inactive' ? 'Paciente desativado.' : 'Paciente reativado.');
      setConfirmModal({ isOpen: false, patient: null });
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível alterar o status.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async (rows: SpreadsheetRow[]) => {
    let imported = 0;
    const problems: string[] = [];

    for (const [index, row] of rows.entries()) {
      const line = index + 2; // +1 do cabeçalho, +1 para base 1
      const name = readField(row, 'name', 'nome');
      const cpf = formatCPF(readField(row, 'cpf'));
      const birthDate = readField(row, 'birthDate', 'nascimento', 'dataNascimento');

      if (!name || !cpf) {
        problems.push(`Linha ${line}: nome e CPF são obrigatórios.`);
        continue;
      }
      if (!validateCPF(cpf)) {
        problems.push(`Linha ${line}: CPF inválido (${cpf}).`);
        continue;
      }
      if (patients.some((patient) => onlyDigits(patient.cpf) === onlyDigits(cpf))) {
        problems.push(`Linha ${line}: CPF já cadastrado.`);
        continue;
      }

      const patient: Patient = {
        id: sanitizeId(readField(row, 'id')) ?? generateId(),
        name,
        cpf,
        birthDate: validateBirthDate(birthDate) ? birthDate : todayISO(),
        contact: readField(row, 'contact', 'contato', 'telefone'),
        bloodType: readField(row, 'bloodType', 'tipoSanguineo'),
        description: readField(row, 'description', 'descricao', 'observacoes'),
        status: readField(row, 'status') === 'inactive' ? 'inactive' : 'active',
      };

      try {
        await savePatient(patient, 'create');
        imported++;
      } catch (error) {
        problems.push(`Linha ${line}: ${describeError(error, 'falha ao gravar.')}`);
      }
    }

    if (imported > 0) toast.success(`${imported} paciente(s) importado(s).`);
    if (problems.length > 0) {
      toast.warning(`${problems.length} linha(s) ignorada(s). ${problems.slice(0, 2).join(' ')}`);
      console.warn('Importação de pacientes:', problems);
    }
  };

  /** Geração de PDF carrega a biblioteca sob demanda e pode falhar. */
  const emitDocument = async (task: Promise<void>) => {
    try {
      await task;
    } catch (error) {
      toast.error(describeError(error, 'Não foi possível gerar o PDF.'));
    }
  };

  const patientHistory = useMemo(() => {
    if (!summaryPatient) return [];
    return appointments
      .filter((appointment) => appointment.patientId === summaryPatient.id)
      .sort((a, b) => dateTimeValue(b.date, b.time) - dateTimeValue(a.date, a.time));
  }, [appointments, summaryPatient]);

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <ImportExportButtons onImport={handleImport} exportData={patients} exportFileName="pacientes" />
          <button
            type="button"
            onClick={openCreateModal}
            className="ml-auto flex items-center whitespace-nowrap rounded-xl bg-gray-900 px-4 py-2.5 font-medium text-white transition hover:bg-gray-800"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Novo paciente
          </button>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-6 sm:flex-row">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar paciente por nome ou CPF"
              placeholder="Buscar por nome ou CPF..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <select
            aria-label="Filtrar por status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Todos os status</option>
            <option value="active">Apenas ativos</option>
            <option value="inactive">Apenas inativos</option>
          </select>
          <p className="self-center text-sm text-gray-500" aria-live="polite">
            {isDataLoaded ? `${filteredPatients.length} de ${patients.length}` : 'Carregando...'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-gray-50 font-medium text-gray-600">
              <tr>
                <th scope="col" className="px-6 py-3">Nome</th>
                <th scope="col" className="px-6 py-3">CPF</th>
                <th scope="col" className="hidden px-6 py-3 md:table-cell">Idade</th>
                <th scope="col" className="px-6 py-3">Contato</th>
                <th scope="col" className="px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {!isDataLoaded ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 w-3/4 rounded bg-gray-200" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                    <td className="hidden px-6 py-4 md:table-cell"><div className="h-4 w-10 rounded bg-gray-200" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-32 rounded bg-gray-200" /></td>
                    <td className="px-6 py-4"><div className="h-6 w-16 rounded-full bg-gray-200" /></td>
                  </tr>
                ))
              ) : displayedItems.length > 0 ? (
                displayedItems.map((patient) => {
                  const age = ageFromBirthDate(patient.birthDate);
                  return (
                    <tr key={patient.id} className="transition hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <button
                          type="button"
                          onClick={() => setSummaryPatient(patient)}
                          className="rounded text-left transition hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        >
                          {patient.name}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-600">{patient.cpf}</td>
                      <td className="hidden px-6 py-4 md:table-cell">{age !== null ? `${age} anos` : '—'}</td>
                      <td className="px-6 py-4">{patient.contact || '—'}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                            patient.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700',
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', patient.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500')} />
                          {patient.status === 'active' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    {patients.length === 0 ? 'Nenhum paciente cadastrado ainda.' : 'Nenhum paciente encontrado para esta busca.'}
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
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPatient ? 'Editar paciente' : 'Novo paciente'}
        description={editingPatient ? 'CPF e data de nascimento não podem ser alterados após o cadastro.' : undefined}
      >
        <form onSubmit={handleSave} className="space-y-4" noValidate>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="patient-name" className="mb-1 block text-sm font-medium text-gray-700">Nome completo</label>
              <input
                id="patient-name"
                required
                name="name"
                defaultValue={editingPatient?.name}
                aria-invalid={Boolean(formErrors.name)}
                className={cn('w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-primary-500', formErrors.name ? 'border-red-500' : 'border-gray-300')}
              />
              {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="patient-cpf" className="mb-1 block text-sm font-medium text-gray-700">CPF</label>
              <input
                id="patient-cpf"
                required
                name="cpf"
                inputMode="numeric"
                value={editingPatient ? editingPatient.cpf : cpfValue}
                disabled={Boolean(editingPatient)}
                onChange={(event) => {
                  setCpfValue(formatCPF(event.target.value));
                  setFormErrors((errors) => ({ ...errors, cpf: '' }));
                }}
                placeholder="000.000.000-00"
                aria-invalid={Boolean(formErrors.cpf)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 font-mono focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500',
                  formErrors.cpf ? 'border-red-500' : 'border-gray-300',
                )}
              />
              {formErrors.cpf && <p className="mt-1 text-xs text-red-500">{formErrors.cpf}</p>}
            </div>

            <div>
              <label htmlFor="patient-birth" className="mb-1 block text-sm font-medium text-gray-700">Data de nascimento</label>
              <input
                id="patient-birth"
                required
                type="date"
                name="birthDate"
                max={todayISO()}
                defaultValue={editingPatient?.birthDate}
                disabled={Boolean(editingPatient)}
                aria-invalid={Boolean(formErrors.birthDate)}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500',
                  formErrors.birthDate ? 'border-red-500' : 'border-gray-300',
                )}
              />
              {formErrors.birthDate && <p className="mt-1 text-xs text-red-500">{formErrors.birthDate}</p>}
            </div>

            <div>
              <label htmlFor="patient-contact" className="mb-1 block text-sm font-medium text-gray-700">Contato (telefone)</label>
              <input
                id="patient-contact"
                required
                name="contact"
                defaultValue={editingPatient?.contact}
                placeholder="(11) 90000-0000"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label htmlFor="patient-blood" className="mb-1 block text-sm font-medium text-gray-700">Tipo sanguíneo</label>
              <select
                id="patient-blood"
                name="bloodType"
                defaultValue={editingPatient?.bloodType || ''}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Não informado</option>
                {BLOOD_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="patient-status" className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select
                id="patient-status"
                name="status"
                defaultValue={editingPatient?.status || 'active'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="patient-description" className="mb-1 block text-sm font-medium text-gray-700">Descrição clínica</label>
              <textarea
                id="patient-description"
                name="description"
                defaultValue={editingPatient?.description}
                rows={3}
                placeholder="Alergias, comorbidades e observações clínicas"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition hover:bg-primary-700 disabled:opacity-60">
              {isSaving ? 'Salvando...' : 'Salvar paciente'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, patient: null })}
        onConfirm={handleToggleStatus}
        isLoading={isSaving}
        title={confirmModal.patient?.status === 'active' ? 'Desativar paciente' : 'Ativar paciente'}
        message={
          <span>
            Tem certeza que deseja <strong>{confirmModal.patient?.status === 'active' ? 'desativar' : 'ativar'}</strong> o cadastro de{' '}
            <strong>{confirmModal.patient?.name}</strong>? O histórico de atendimentos é preservado.
          </span>
        }
        confirmText={confirmModal.patient?.status === 'active' ? 'Desativar' : 'Ativar'}
        isDestructive={confirmModal.patient?.status === 'active'}
      />

      <Modal
        isOpen={Boolean(summaryPatient)}
        onClose={() => {
          setSummaryPatient(null);
          setActiveSummaryTab('dados');
        }}
        title="Resumo do paciente"
        className="max-w-2xl"
      >
        {summaryPatient && (
          <div className="space-y-6">
            <div className="flex gap-2 border-b border-gray-200" role="tablist">
              {(['dados', 'historico'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeSummaryTab === tab}
                  onClick={() => setActiveSummaryTab(tab)}
                  className={cn(
                    'border-b-2 px-4 py-2 text-sm font-medium transition',
                    activeSummaryTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700',
                  )}
                >
                  {tab === 'dados' ? 'Dados do paciente' : `Histórico (${patientHistory.length})`}
                </button>
              ))}
            </div>

            {activeSummaryTab === 'dados' ? (
              <div className="space-y-6">
                <div className="flex gap-4 rounded-xl bg-primary-50 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                    <User className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{summaryPatient.name}</h3>
                    <p className="text-sm text-gray-600">
                      CPF: {summaryPatient.cpf} · Nasc.: {formatDateBR(summaryPatient.birthDate)}
                      {ageFromBirthDate(summaryPatient.birthDate) !== null && ` (${ageFromBirthDate(summaryPatient.birthDate)} anos)`}
                    </p>
                    <p className="text-sm text-gray-600">Contato: {summaryPatient.contact || '—'}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {summaryPatient.bloodType && (
                        <span className="rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                          Sangue: {summaryPatient.bloodType}
                        </span>
                      )}
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-xs font-semibold',
                          summaryPatient.status === 'active'
                            ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                            : 'border-gray-200 bg-gray-100 text-gray-700',
                        )}
                      >
                        {summaryPatient.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <h4 className="mb-2 flex items-center font-semibold text-blue-800">
                    <FileText className="mr-1 h-4 w-4" aria-hidden="true" />
                    Descrição / observações clínicas
                  </h4>
                  <p className="whitespace-pre-wrap text-sm text-blue-900">
                    {summaryPatient.description || 'Nenhuma descrição registrada.'}
                  </p>
                </div>

                {canEdit && (
                  <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                    {currentUserRole === 'admin' && (
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmModal({ isOpen: true, patient: summaryPatient });
                          setSummaryPatient(null);
                        }}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border px-4 py-2 font-medium transition',
                          summaryPatient.status === 'active'
                            ? 'border-red-200 text-red-600 hover:bg-red-50'
                            : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50',
                        )}
                      >
                        {summaryPatient.status === 'active' ? (
                          <><Ban className="h-4 w-4" aria-hidden="true" /> Desativar</>
                        ) : (
                          <><CheckCircle className="h-4 w-4" aria-hidden="true" /> Ativar</>
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        openEditModal(summaryPatient);
                        setSummaryPatient(null);
                      }}
                      className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition hover:bg-primary-700"
                    >
                      <Edit2 className="h-4 w-4" aria-hidden="true" />
                      Editar dados
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <h4 className="mb-3 flex items-center border-b pb-2 font-bold text-gray-800">
                  <CalendarIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                  Consultas e exames
                </h4>
                <div className="max-h-64 space-y-3 overflow-y-auto pr-2">
                  {patientHistory.length > 0 ? (
                    patientHistory.map((appointment) => {
                      const doctor = doctors.find((item) => item.id === appointment.doctorId);
                      return (
                        <div key={appointment.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <span className="font-semibold text-gray-800">
                              {formatDateBR(appointment.date)} às {appointment.time}
                            </span>
                            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_STYLES[appointment.status])}>
                              {appointment.status}
                            </span>
                          </div>
                          <p className="text-gray-600">
                            <span className="font-medium">Profissional:</span> {doctor?.name || 'Não identificado'} ({appointment.type})
                          </p>
                          {appointment.cid10 && <p className="text-gray-600"><span className="font-medium">CID-10:</span> {appointment.cid10}</p>}
                          {appointment.notes && <p className="mt-1 italic text-gray-500">Obs: {appointment.notes}</p>}

                          <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-200 pt-3">
                            {DOCUMENT_TYPES.map((docType) => (
                              <button
                                key={docType}
                                type="button"
                                onClick={() => void emitDocument(generateDocumentPDF(summaryPatient, appointment, doctor, docType))}
                                className="flex items-center rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-primary-50 hover:text-primary-700"
                              >
                                <FileOutput className="mr-1 h-3 w-3" aria-hidden="true" /> {docType}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="py-4 text-center text-sm text-gray-500">Nenhum agendamento encontrado para este paciente.</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setSummaryPatient(null);
                  setActiveSummaryTab('dados');
                }}
                className="rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => void emitDocument(generatePatientSummaryPDF(summaryPatient, patientHistory, doctors))}
                className="flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition hover:bg-primary-700"
              >
                <Download className="h-5 w-5" aria-hidden="true" /> Exportar resumo
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
