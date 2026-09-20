import { FormEvent, useMemo, useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Edit2, Plus, Search, ShieldAlert } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ImportExportButtons } from '../components/ui/ImportExportButtons';
import { useToast } from '../components/ui/Toast';
import { Doctor, Role, SystemUser } from '../types';
import { db, getSecondaryAuth } from '../lib/firebase';
import { OperationType, authErrorMessage, describeError, toAppError } from '../lib/firebase-errors';
import { formatCPF, validateCPF, validateCRM } from '../lib/validators';
import { SpreadsheetRow, readField } from '../lib/spreadsheet';
import { ROLE_NAMES } from '../lib/navigation';
import { cn } from '../lib/utils';

const ROLES: Role[] = ['reception', 'doctor', 'pharmacy', 'admin'];
const MIN_PASSWORD_LENGTH = 6;

interface UserFormData {
  email: string;
  password: string;
  name: string;
  role: Role;
  cpf: string;
  contact: string;
  specialty: string;
  crm: string;
  availability: string;
  status: 'active' | 'inactive';
}

/** Usuário em edição, com os dados profissionais já resolvidos. */
type EditingUser = SystemUser & { doctorData?: Doctor };

/** Retrato para a auditoria, sem a senha e sem campos vazios. */
function auditSnapshot(source: Partial<UserFormData> & Partial<EditingUser>): Record<string, unknown> {
  const { password: _password, doctorData: _doctorData, ...rest } = source;
  return rest;
}

export function Usuarios() {
  const { systemUsers, doctors, isDataLoaded, recordAudit } = useAppContext();
  const toast = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>('reception');
  const [activeTab, setActiveTab] = useState<'personal' | 'professional'>('personal');
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; data: UserFormData | null }>({ isOpen: false, data: null });

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return systemUsers
      .filter((user) => {
        const matchesSearch =
          !term || user.name?.toLowerCase().includes(term) || user.email?.toLowerCase().includes(term);
        const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
        const matchesRole = roleFilter === 'all' || user.role === roleFilter;
        return matchesSearch && matchesStatus && matchesRole;
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
  }, [systemUsers, searchTerm, statusFilter, roleFilter]);

  const { displayedItems, loadMoreRef, hasMore } = useInfiniteScroll(
    filteredUsers,
    15,
    `${searchTerm}|${statusFilter}|${roleFilter}`,
  );

  const validate = (data: UserFormData, isNew: boolean): string | null => {
    if (!data.name.trim()) return 'Informe o nome completo.';
    if (!data.email.trim()) return 'Informe o e-mail de acesso.';
    if (isNew && data.password.length < MIN_PASSWORD_LENGTH) return `A senha inicial precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    if (data.cpf && !validateCPF(data.cpf)) return 'CPF inválido. Use o formato XXX.XXX.XXX-XX e confira os dígitos.';
    // `validateCRM` existia no projeto mas nunca era chamado: qualquer texto
    // era aceito como registro profissional.
    if (data.role === 'doctor' && !validateCRM(data.crm)) return 'CRM inválido. Use o formato NÚMERO-UF (ex.: 12345-SP).';
    if (data.role === 'doctor' && !data.specialty.trim()) return 'Informe a especialidade do profissional.';
    return null;
  };

  const readForm = (form: HTMLFormElement): UserFormData => {
    const formData = new FormData(form);
    return {
      email: String(formData.get('email') ?? editingUser?.email ?? '').trim(),
      password: String(formData.get('password') ?? ''),
      name: String(formData.get('name') ?? '').trim(),
      role: (String(formData.get('role') ?? '') as Role) || editingUser?.role || selectedRole,
      cpf: String(formData.get('cpf') ?? '').trim(),
      contact: String(formData.get('contact') ?? '').trim(),
      specialty: String(formData.get('specialty') ?? '').trim(),
      crm: String(formData.get('crm') ?? '').trim().toUpperCase(),
      availability: String(formData.get('availability') ?? '').trim(),
      status: (String(formData.get('status') ?? 'active') as 'active' | 'inactive') || 'active',
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = readForm(event.currentTarget);

    const error = validate(data, !editingUser);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError('');

    // Alterações em contas existentes passam por confirmação explícita.
    if (editingUser) setConfirmModal({ isOpen: true, data });
    else await processSave(data);
  };

  const writeProfile = async (uid: string, data: UserFormData, merge: boolean) => {
    try {
      await setDoc(
        doc(db, 'users', uid),
        { email: data.email, name: data.name, role: data.role, cpf: data.cpf, contact: data.contact, status: data.status },
        { merge },
      );

      if (data.role === 'doctor') {
        await setDoc(
          doc(db, 'doctors', uid),
          {
            name: data.name,
            email: data.email,
            contact: data.contact,
            crm: data.crm,
            specialty: data.specialty,
            availability: data.availability || 'A definir',
            status: data.status,
          },
          { merge },
        );
      }
    } catch (error) {
      throw toAppError(error, merge ? OperationType.UPDATE : OperationType.CREATE, `users/${uid}`);
    }
  };

  const processSave = async (data: UserFormData) => {
    setIsSaving(true);
    try {
      if (editingUser) {
        await writeProfile(editingUser.id, data, true);
        await recordAudit({
          action: 'Edição de Usuário',
          entityType: 'Usuário',
          entityId: editingUser.id,
          entityName: data.name,
          details: `Atualizou o cadastro de ${data.name} (${ROLE_NAMES[data.role]}), status ${data.status}.`,
          beforeData: auditSnapshot(editingUser),
          afterData: auditSnapshot(data),
        });
        toast.success('Usuário atualizado.');
      } else {
        // App secundário: criar a conta no app principal derrubaria a sessão
        // do administrador que está cadastrando.
        const secondaryAuth = getSecondaryAuth();
        const credential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
        await updateProfile(credential.user, { displayName: data.name });
        await writeProfile(credential.user.uid, data, false);
        await secondaryAuth.signOut();

        await recordAudit({
          action: 'Criação de Usuário',
          entityType: 'Usuário',
          entityId: credential.user.uid,
          entityName: data.name,
          details: `Criou o acesso de ${data.name} (${ROLE_NAMES[data.role]}).`,
          afterData: auditSnapshot(data),
        });
        toast.success('Usuário criado com sucesso.');
      }

      setIsModalOpen(false);
      setEditingUser(null);
      setConfirmModal({ isOpen: false, data: null });
      setActiveTab('personal');
    } catch (error) {
      const message = error instanceof Error && error.name === 'AppError' ? describeError(error) : authErrorMessage(error);
      setFormError(message);
      setConfirmModal({ isOpen: false, data: null });
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async (rows: SpreadsheetRow[]) => {
    let imported = 0;
    const problems: string[] = [];

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const data: UserFormData = {
        email: readField(row, 'email'),
        // Antes a importação criava contas com a senha fixa "senha12345"
        // para qualquer linha sem senha — um acesso previsível ao sistema.
        password: readField(row, 'password', 'senha'),
        name: readField(row, 'name', 'nome'),
        role: (readField(row, 'role', 'funcao', 'perfil') as Role) || 'reception',
        cpf: formatCPF(readField(row, 'cpf')),
        contact: readField(row, 'contact', 'contato', 'telefone'),
        specialty: readField(row, 'specialty', 'especialidade'),
        crm: readField(row, 'crm').toUpperCase(),
        availability: readField(row, 'availability', 'disponibilidade'),
        status: readField(row, 'status') === 'inactive' ? 'inactive' : 'active',
      };

      if (!ROLES.includes(data.role)) {
        problems.push(`Linha ${line}: função "${data.role}" inválida.`);
        continue;
      }
      const error = validate(data, true);
      if (error) {
        problems.push(`Linha ${line}: ${error}`);
        continue;
      }

      try {
        const secondaryAuth = getSecondaryAuth();
        const credential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
        await updateProfile(credential.user, { displayName: data.name });
        await writeProfile(credential.user.uid, data, false);
        await secondaryAuth.signOut();
        imported++;
      } catch (error) {
        problems.push(`Linha ${line}: ${authErrorMessage(error)}`);
      }
    }

    if (imported > 0) toast.success(`${imported} usuário(s) criado(s).`);
    if (problems.length > 0) {
      toast.warning(`${problems.length} linha(s) ignorada(s). ${problems.slice(0, 2).join(' ')}`);
      console.warn('Importação de usuários:', problems);
    }
  };

  const openNew = () => {
    setEditingUser(null);
    setSelectedRole('reception');
    setActiveTab('personal');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (user: SystemUser) => {
    setEditingUser({ ...user, doctorData: user.role === 'doctor' ? doctors.find((doctor) => doctor.id === user.id) : undefined });
    setSelectedRole(user.role);
    setActiveTab('personal');
    setFormError('');
    setIsModalOpen(true);
  };

  const showProfessionalTab = selectedRole === 'doctor';

  return (
    <div className="flex h-full flex-col space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex w-full flex-1 flex-col gap-4 sm:flex-row sm:w-auto">
          <div className="relative w-full max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              type="search"
              aria-label="Buscar usuário por nome ou e-mail"
              placeholder="Buscar usuário..."
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <select
            aria-label="Filtrar por função"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Todas as funções</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>{ROLE_NAMES[role]}</option>
            ))}
          </select>
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
        </div>

        <div className="flex w-full shrink-0 items-center gap-3 sm:w-auto">
          <ImportExportButtons
            onImport={handleImport}
            exportData={systemUsers.map(({ id, name, email, role, cpf, contact, status }) => ({
              id,
              name,
              email,
              role,
              cpf,
              contact,
              status,
            }))}
            exportFileName="usuarios"
          />
          <button
            type="button"
            onClick={openNew}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white transition hover:bg-primary-700"
          >
            <Plus className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">Novo usuário</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex-1 overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-gray-50 font-medium text-gray-600">
              <tr>
                <th scope="col" className="px-6 py-3">Nome</th>
                <th scope="col" className="px-6 py-3">E-mail</th>
                <th scope="col" className="px-6 py-3">Função</th>
                <th scope="col" className="px-6 py-3">Status</th>
                <th scope="col" className="px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {!isDataLoaded ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    {Array.from({ length: 5 }).map((__, cell) => (
                      <td key={cell} className="px-6 py-4"><div className="h-4 w-24 rounded bg-gray-200" /></td>
                    ))}
                  </tr>
                ))
              ) : displayedItems.length > 0 ? (
                displayedItems.map((user) => (
                  <tr key={user.id} className="transition hover:bg-gray-50/50">
                    <td className="px-6 py-4 font-medium text-gray-900">{user.name}</td>
                    <td className="px-6 py-4">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800">
                        {ROLE_NAMES[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                          user.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-700',
                        )}
                      >
                        <span className={cn('h-1.5 w-1.5 rounded-full', user.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500')} />
                        {user.status === 'active' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => openEdit(user)}
                        className="text-primary-600 transition hover:text-primary-800"
                        title={`Editar ${user.name}`}
                      >
                        <Edit2 className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Editar usuário</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    {searchTerm ? 'Nenhum usuário encontrado na busca.' : 'Nenhum usuário cadastrado.'}
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
        onClose={() => {
          setIsModalOpen(false);
          setEditingUser(null);
          setActiveTab('personal');
        }}
        title={editingUser ? 'Editar usuário' : 'Cadastrar novo usuário'}
        description={editingUser ? 'E-mail e função não podem ser alterados após a criação da conta.' : undefined}
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {formError && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          {showProfessionalTab && (
            <div className="mb-4 flex border-b border-gray-200" role="tablist">
              {(['personal', 'professional'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                    activeTab === tab ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                  )}
                >
                  {tab === 'personal' ? 'Informações pessoais' : 'Dados profissionais'}
                </button>
              ))}
            </div>
          )}

          <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', showProfessionalTab && activeTab !== 'personal' && 'hidden')}>
            <div>
              <label htmlFor="user-name" className="mb-1 block text-sm font-medium text-gray-700">Nome completo</label>
              <input id="user-name" required name="name" defaultValue={editingUser?.name} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label htmlFor="user-email" className="mb-1 block text-sm font-medium text-gray-700">E-mail (login)</label>
              <input
                id="user-email"
                type="email"
                required
                name="email"
                autoComplete="off"
                defaultValue={editingUser?.email}
                disabled={Boolean(editingUser)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
              />
            </div>
            {!editingUser && (
              <div>
                <label htmlFor="user-password" className="mb-1 block text-sm font-medium text-gray-700">Senha inicial</label>
                <input
                  id="user-password"
                  type="password"
                  required
                  name="password"
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD_LENGTH}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
                />
                <p className="mt-1 text-xs text-gray-500">Mínimo de {MIN_PASSWORD_LENGTH} caracteres. Oriente a troca no primeiro acesso.</p>
              </div>
            )}
            <div>
              <label htmlFor="user-cpf" className="mb-1 block text-sm font-medium text-gray-700">CPF</label>
              <input
                id="user-cpf"
                required
                name="cpf"
                inputMode="numeric"
                defaultValue={editingUser?.cpf}
                placeholder="000.000.000-00"
                onChange={(event) => {
                  event.target.value = formatCPF(event.target.value);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label htmlFor="user-contact" className="mb-1 block text-sm font-medium text-gray-700">Contato / telefone</label>
              <input id="user-contact" required name="contact" defaultValue={editingUser?.contact} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label htmlFor="user-role" className="mb-1 block text-sm font-medium text-gray-700">Função</label>
              <select
                id="user-role"
                name="role"
                value={selectedRole}
                onChange={(event) => {
                  const role = event.target.value as Role;
                  setSelectedRole(role);
                  if (role !== 'doctor') setActiveTab('personal');
                }}
                disabled={Boolean(editingUser)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                {ROLES.map((role) => (
                  <option key={role} value={role}>{ROLE_NAMES[role]}</option>
                ))}
              </select>
            </div>
            {editingUser && (
              <div className="md:col-span-2">
                <label htmlFor="user-status" className="mb-1 block text-sm font-medium text-gray-700">Status do sistema</label>
                <select id="user-status" name="status" defaultValue={editingUser.status || 'active'} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500">
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo (bloqueado)</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">Contas inativas são impedidas de entrar no sistema.</p>
              </div>
            )}
          </div>

          {showProfessionalTab && (
            <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-2', activeTab !== 'professional' && 'hidden')}>
              <div>
                <label htmlFor="user-crm" className="mb-1 block text-sm font-medium text-gray-700">CRM</label>
                <input
                  id="user-crm"
                  name="crm"
                  defaultValue={editingUser?.doctorData?.crm}
                  placeholder="12345-SP"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 uppercase focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label htmlFor="user-specialty" className="mb-1 block text-sm font-medium text-gray-700">Especialidade</label>
                <input id="user-specialty" name="specialty" defaultValue={editingUser?.doctorData?.specialty} className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="user-availability" className="mb-1 block text-sm font-medium text-gray-700">Disponibilidade</label>
                <input
                  id="user-availability"
                  name="availability"
                  defaultValue={editingUser?.doctorData?.availability}
                  placeholder="Ex.: Segundas e quartas, 08:00 às 12:00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setEditingUser(null);
                setActiveTab('personal');
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition hover:bg-primary-700 disabled:opacity-60">
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, data: null })}
        onConfirm={() => confirmModal.data && void processSave(confirmModal.data)}
        isLoading={isSaving}
        title="Confirmar alterações"
        message={
          <span>
            Salvar as alterações de <strong>{confirmModal.data?.name}</strong>? Perfis de acesso são sensíveis e afetam o que o
            usuário enxerga no sistema.
          </span>
        }
        confirmText="Salvar alterações"
        isDestructive={false}
      />
    </div>
  );
}
