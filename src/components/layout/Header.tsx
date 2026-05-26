import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { Role } from '../../types';
import { Shield, Bell, UserCircle, LogOut } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const roleNames: Record<Role, string> = {
  admin: 'Administrador',
  reception: 'Recepção',
  doctor: 'Médico',
  pharmacy: 'Farmacêutico'
};

export function Header() {
  const { currentUserRole, user, logout } = useAppContext();
  const location = useLocation();

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
        <div className="bg-white px-4 py-2 rounded-xl border border-gray-200 flex items-center gap-3 shadow-sm">
          {user?.photoURL ? (
            <img src={user.photoURL} alt={userDisplayName} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs uppercase">
              {userDisplayName.substring(0, 2)}
            </div>
          )}
          <div className="text-sm hidden md:block border-r border-gray-100 pr-3">
            <p className="font-medium text-gray-700 leading-none mb-1 truncate max-w-[120px]">{userDisplayName}</p>
            <p className="text-gray-400 text-xs leading-none"> {roleNames[currentUserRole]}</p>
          </div>
          <button onClick={logout} className="text-gray-400 hover:text-red-500 transition pl-1" title="Sair">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
