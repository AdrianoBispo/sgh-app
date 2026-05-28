import React, { useState } from 'react';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { useAppContext } from '../context/AppContext';
import { Plus, Edit2, Ban, CheckCircle, Search, UserCircle, Key } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { ImportExportButtons } from '../components/ui/ImportExportButtons';
import { Role } from '../types';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import type { FirebaseOptions } from 'firebase/app';
// @ts-ignore
import firebaseConfig from '../../firebase-applet-config.json';
import { setDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const secondaryApp = initializeApp(firebaseConfig as FirebaseOptions, "Secondary");
const secondaryAuth = getAuth(secondaryApp);

export function Usuarios() {
  const { systemUsers, user, updateDoctor, addDoctor, doctors } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState<any>(null);

  const filteredUsers = systemUsers.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const { displayedItems, loadMoreRef, hasMore } = useInfiniteScroll(filteredUsers, 15);

  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; data: any}>({isOpen: false, data: null});

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as Role;
    const cpf = formData.get('cpf') as string;
    const contact = formData.get('contact') as string;
    const specialty = formData.get('specialty') as string;
    const crm = formData.get('crm') as string;
    const availability = formData.get('availability') as string;
    const status = formData.get('status') as string || 'active';

    const data = { email, password, name, role, cpf, contact, specialty, crm, availability, status };

    if (editingUser) {
      setConfirmModal({ isOpen: true, data });
    } else {
      await processSave(data);
    }
  };

  const processSave = async (data: any) => {
    setAuthLoading(true);
    try {
      if (editingUser) {
         await setDoc(doc(db, 'users', editingUser.id), {
           email: data.email,
           name: data.name,
           role: data.role,
           cpf: data.cpf,
           contact: data.contact,
           status: data.status
         }, { merge: true });

         if (data.role === 'doctor') {
           await setDoc(doc(db, 'doctors', editingUser.id), {
             name: data.name,
             email: data.email,
             contact: data.contact,
             crm: data.crm,
             specialty: data.specialty,
             availability: data.availability,
             status: data.status
           }, { merge: true });
         }
      } else {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
        await updateProfile(userCredential.user, { displayName: data.name });
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: userCredential.user.email,
          name: data.name,
          role: data.role,
          cpf: data.cpf,
          contact: data.contact,
          status: data.status
        });

        if (data.role === 'doctor') {
          await setDoc(doc(db, 'doctors', userCredential.user.uid), {
            name: data.name,
            email: data.email,
            contact: data.contact,
            crm: data.crm,
            specialty: data.specialty,
            availability: data.availability,
            status: data.status
          });
        }
        await secondaryAuth.signOut();
      }
      
      setIsModalOpen(false);
      setEditingUser(null);
      setConfirmModal({ isOpen: false, data: null });
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado.');
      } else {
        setError('Ocorreu um erro. Tente novamente.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleImport = async (data: any[]) => {
    let count = 0;
    for (const row of data) {
      if (row.email && row.name && row.role) {
        await processSave({
          email: row.email,
          password: row.password || 'senha12345',
          name: row.name,
          role: row.role as Role,
          cpf: row.cpf || '',
          contact: row.contact || '',
          specialty: row.specialty || '',
          crm: row.crm || '',
          availability: row.availability || '',
          status: row.status === 'inactive' ? 'inactive' : 'active'
        });
        count++;
      }
    }
    if (count > 0) alert(`${count} usuário(s) importado(s) com sucesso! As senhas padrões são 'senha12345' para novos usuários caso não fornecidas.`);
  };

  const roleNames: Record<string, string> = {
    admin: 'Administrador',
    reception: 'Recepção',
    doctor: 'Médico',
    pharmacy: 'Farmacêutico',
  };

  const [selectedRole, setSelectedRole] = useState('reception');
  const [activeTab, setActiveTab] = useState<'personal' | 'professional'>('personal');

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto flex-1">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input 
              type="text"
              placeholder="Buscar usuário..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-primary-500 outline-none text-sm"
          >
            <option value="all">Todas as Funções</option>
            <option value="reception">Recepção</option>
            <option value="doctor">Médicos</option>
            <option value="pharmacy">Farmácia</option>
            <option value="admin">Administração</option>
          </select>
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
        <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0 shrink-0">
          <ImportExportButtons 
            onImport={handleImport}
            exportData={systemUsers.map(u => ({ ...u, password: '' }))}
            exportFileName="usuarios"
          />
          <button 
            onClick={() => { setEditingUser(null); setIsModalOpen(true); setSelectedRole('reception'); }}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
          >
            <Plus className="w-5 h-5 shrink-0" />
            <span className="whitespace-nowrap">Novo Usuário</span>
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-6 py-3">Nome</th>
                <th className="px-6 py-3">E-mail</th>
                <th className="px-6 py-3">Função</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {displayedItems.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                  <td className="px-6 py-4">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {roleNames[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5 ${u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
                      {u.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => {
                        const doctorData = u.role === 'doctor' ? doctors.find(d => d.id === u.id) : null;
                        setEditingUser({ ...u, doctorData });
                        setSelectedRole(u.role);
                        setIsModalOpen(true);
                      }}
                      className="text-primary-600 hover:text-primary-900 transition"
                      title="Editar Usuário"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                 <tr>
                 <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                   {searchTerm ? 'Nenhum usuário encontrado na busca.' : 'Nenhum usuário cadastrado.'}
                 </td>
               </tr>
              )}
            </tbody>
          </table>
          {hasMore && <div ref={loadMoreRef} className="h-10 flex justify-center items-center text-gray-400 text-sm">Carregando mais...</div>}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingUser(null); setActiveTab('personal'); }}
        title={editingUser ? "Editar Usuário" : "Cadastrar Novo Usuário"}
      >
         <form onSubmit={handleSubmit} className="space-y-4">
           {error && (
             <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 text-center">
               {error}
             </div>
           )}

            {selectedRole === 'doctor' && (
              <div className="flex border-b border-gray-200 mb-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('personal')}
                  className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'personal' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Informações Pessoais
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('professional')}
                  className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${activeTab === 'professional' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  Dados Profissionais
                </button>
              </div>
            )}
           
           <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${activeTab === 'personal' || selectedRole !== 'doctor' ? 'block' : 'hidden'}`}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input required name="name" defaultValue={editingUser?.name} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail (Login)</label>
                <input type="email" required name="email" defaultValue={editingUser?.email} disabled={!!editingUser} className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500" />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha Inicial</label>
                  <input type="password" required name="password" minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                </div>
              )}
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                <input required name="cpf" defaultValue={editingUser?.cpf} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contato / Telefone</label>
                <input required name="contact" defaultValue={editingUser?.contact} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
                <select 
                  name="role" 
                  value={selectedRole || ''}
                  onChange={e => { setSelectedRole(e.target.value); if (e.target.value !== 'doctor') setActiveTab('personal'); }}
                  disabled={!!editingUser}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 disabled:bg-gray-100 disabled:text-gray-500"
                >
                  <option value="reception">Recepção</option>
                  <option value="doctor">Médico</option>
                  <option value="pharmacy">Farmacêutico</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

               {editingUser && (
                 <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status do Sistema</label>
                    <select name="status" defaultValue={editingUser?.status || 'active'} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                      <option value="active">Ativo</option>
                      <option value="inactive">Inativo (Bloqueado)</option>
                    </select>
                 </div>
               )}
           </div>

           <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${activeTab === 'professional' && selectedRole === 'doctor' ? 'block' : 'hidden'}`}>
              {selectedRole === 'doctor' && (
                <>
                  <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">CRM</label>
                   <input required={selectedRole === 'doctor'} name="crm" defaultValue={editingUser?.doctorData?.crm} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Especialidade</label>
                   <input required={selectedRole === 'doctor'} name="specialty" defaultValue={editingUser?.doctorData?.specialty} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                 </div>
                 <div className="md:col-span-2">
                   <label className="block text-sm font-medium text-gray-700 mb-1">Disponibilidade</label>
                   <input name="availability" defaultValue={editingUser?.doctorData?.availability} placeholder="Ex: Segundas e Quartas, 08:00 às 12:00" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                 </div>
                </>
              )}
           </div>
           
            <div className="pt-4 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => { setIsModalOpen(false); setEditingUser(null); setActiveTab('personal'); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={authLoading}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
              >
                {authLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
         </form>
      </Modal>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({isOpen: false, data: null})}
        onConfirm={() => processSave(confirmModal.data)}
        title="Confirmar Alterações"
        message="Deseja realmente salvar as alterações neste usuário? Perfils sensíveis não devem ser alterados acidentalmente."
        confirmText="Salvar Alterações"
        isDestructive={false}
      />
    </div>
  );
}
