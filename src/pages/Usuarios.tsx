import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Edit2, Ban, CheckCircle, Search, UserCircle, Key } from 'lucide-react';
import { Modal } from '../components/ui/Modal';
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
  const { systemUsers, user, updateDoctor, addDoctor } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState('');

  const filteredUsers = systemUsers.filter(u => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setAuthLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as Role;

    // Additional fields
    const cpf = formData.get('cpf') as string;
    const contact = formData.get('contact') as string;
    const specialty = formData.get('specialty') as string;
    const crm = formData.get('crm') as string;
    
    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      
      // Store user record
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        email: userCredential.user.email,
        name: name,
        role: role,
        cpf,
        contact,
        status: 'active'
      });

      if (role === 'doctor') {
        await setDoc(doc(db, 'doctors', userCredential.user.uid), {
          name: name,
          email: email,
          contact: contact,
          crm: crm,
          specialty: specialty,
          status: 'active'
        });
      }

      // Sign out secondary
      await secondaryAuth.signOut();
      
      setIsModalOpen(false);
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

  const roleNames: Record<string, string> = {
    admin: 'Administrador',
    reception: 'Recepção',
    doctor: 'Médico',
    pharmacy: 'Farmacêutico',
  };

  const [selectedRole, setSelectedRole] = useState('reception');

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
        <button 
          onClick={() => { setIsModalOpen(true); setSelectedRole('reception'); }}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition"
        >
          <Plus className="w-5 h-5" />
          Novo Usuário
        </button>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-gray-800">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-6 py-4 font-medium text-gray-900">{u.name}</td>
                  <td className="px-6 py-4">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {roleNames[u.role] || u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${u.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                      {u.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                 <tr>
                 <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                   {searchTerm ? 'Nenhum usuário encontrado na busca.' : 'Nenhum usuário cadastrado.'}
                 </td>
               </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Cadastrar Novo Usuário"
      >
         <form onSubmit={handleSubmit} className="space-y-4">
           {error && (
             <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100 text-center">
               {error}
             </div>
           )}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input required name="name" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail (Login)</label>
                <input type="email" required name="email" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha Provisória</label>
                <input type="password" required name="password" minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                <input required name="cpf" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contato / Telefone</label>
                <input required name="contact" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
                <select 
                  name="role" 
                  value={selectedRole}
                  onChange={e => setSelectedRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  <option value="reception">Recepção</option>
                  <option value="doctor">Médico</option>
                  <option value="pharmacy">Farmacêutico</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

               {selectedRole === 'doctor' && (
                 <>
                   <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CRM</label>
                    <input required name="crm" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Especialidade</label>
                    <input required name="specialty" className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </div>
                 </>
               )}
           </div>
           
            <div className="pt-4 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
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
    </div>
  );
}
