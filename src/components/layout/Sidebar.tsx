import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { 
  HeartPulse,
  LayoutDashboard, 
  Users, 
  Stethoscope, 
  Calendar, 
  Package, 
  FileText 
} from 'lucide-react';
import { cn } from '../../lib/utils';

export function Sidebar() {
  const { currentUserRole } = useAppContext();

  const navigation = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard },
    { name: 'Pacientes', to: '/pacientes', icon: Users, roles: ['admin', 'reception', 'doctor'] },
    { name: 'Agendamentos', to: '/agendamentos', icon: Calendar, roles: ['admin', 'reception', 'doctor'] },
    { name: 'Estoque', to: '/estoque', icon: Package, roles: ['admin', 'pharmacy'] },
    { name: 'Relatórios', to: '/relatorios', icon: FileText, roles: ['admin', 'reception'] },
    { name: 'Usuários', to: '/usuarios', icon: Users, roles: ['admin'] },
  ].filter(item => {
    if (currentUserRole === 'pharmacy') return item.name === 'Dashboard' || item.name === 'Estoque';
    if (!item.roles) return true;
    return item.roles.includes(currentUserRole);
  });

  return (
    <nav className="group w-20 hover:w-64 transition-all duration-300 ease-in-out bg-white border-r border-gray-200 flex flex-col py-6 gap-6 flex-shrink-0 relative overflow-hidden z-20">
      <div className="flex items-center px-4 w-64 gap-4 mb-2">
        <div className="w-12 h-12 flex-shrink-0 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-sm">
          <HeartPulse className="w-7 h-7" />
        </div>
        <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
          <span className="font-bold text-lg text-gray-900 leading-tight">Serene</span>
          <span className="text-xs text-gray-500 font-medium tracking-wide">CLINIC SYSTEM</span>
        </div>
      </div>
      
      <div className="flex flex-col gap-2 text-gray-500 px-3 w-64">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            title={item.name}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl transition-all font-medium cursor-pointer',
                isActive 
                  ? 'bg-primary-50 text-primary-700 shadow-sm' 
                  : 'hover:text-gray-900 hover:bg-gray-100'
              )
            }
          >
            <item.icon className="w-6 h-6 flex-shrink-0" />
            <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-[15px]">
              {item.name}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

