import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Role } from '../../types';
import { Shield, Bell, UserCircle, LogOut, Sun, Moon, Settings } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Modal } from '../ui/Modal';

const roleNames: Record<Role, string> = {
  admin: 'Administrador',
  reception: 'Recepção',
  doctor: 'Médico',
  pharmacy: 'Farmacêutico'
};

export function Header() {
  const { currentUserRole, user, logout } = useAppContext();
  const location = useLocation();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  let title = "Hospital São Gabriel";
  let subtitle = "Gestão Hospitalar Integrada";

  if (location.pathname === '/pacientes') {
    subtitle += " • Pacientes";
  } else if (location.pathname === '/medicos') {
    subtitle += " • Médicos";
  } else if (location.pathname === '/agendamentos') {
    subtitle += " • Agendamentos";
  } else if (location.pathname === '/estoque') {
    subtitle += " • Estoque";
  } else if (location.pathname === '/relatorios') {
    subtitle += " • Relatórios";
  } else {
    subtitle += " • Dashboard Geral";
  }

  const userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'Usuário';

  return (
    <header className="flex justify-between items-center shrink-0">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsConfigOpen(true)}
          className="bg-white px-4 py-2 rounded-xl border border-gray-200 flex items-center gap-3 shadow-sm hover:shadow-md transition cursor-pointer text-left"
        >
          {user?.photoURL ? (
            <img src={user.photoURL} alt={userDisplayName} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs uppercase">
              {userDisplayName.substring(0, 2)}
            </div>
          )}
          <div className="text-sm hidden md:block pr-3">
            <p className="font-medium text-gray-700 leading-none mb-1 truncate max-w-[120px]">{userDisplayName}</p>
            <p className="text-gray-400 text-xs leading-none"> {roleNames[currentUserRole]}</p>
          </div>
        </button>
      </div>

      <Modal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} title="Configurações e Perfil">
        <div className="space-y-6">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={userDisplayName} referrerPolicy="no-referrer" className="w-16 h-16 rounded-full" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-2xl uppercase shadow-inner">
                {userDisplayName.substring(0, 2)}
              </div>
            )}
            <div>
              <h3 className="font-bold text-lg text-gray-900">{user?.displayName || 'Usuário'}</h3>
              <p className="text-gray-600 font-medium text-sm">{user?.email}</p>
              <div className="mt-1">
                 <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-semibold rounded-full border border-primary-200">{roleNames[currentUserRole]}</span>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Aparência</h4>
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-white shadow-sm">
              <div className="flex items-center gap-3">
                 {isDark ? <Moon className="w-5 h-5 text-gray-600" /> : <Sun className="w-5 h-5 text-amber-500" />}
                 <div>
                   <p className="font-medium text-gray-800">Tema do Sistema</p>
                   <p className="text-xs text-gray-500">Alternar entre claro e escuro</p>
                 </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" checked={isDark} onChange={() => setIsDark(!isDark)} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          </div>

           <div>
            <h4 className="text-sm font-semibold text-gray-800 mb-3 uppercase tracking-wider">Sessão</h4>
            <button 
              onClick={() => { setIsConfigOpen(false); logout(); }}
              className="w-full flex items-center justify-between p-3 border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition shadow-sm font-medium"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5" />
                Sair do sistema
              </div>
            </button>
           </div>
        </div>
      </Modal>
    </header>
  );
}
