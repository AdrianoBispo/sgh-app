import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { 
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
    { name: 'Médicos', to: '/medicos', icon: Stethoscope, roles: ['admin', 'reception'] },
    { name: 'Agendamentos', to: '/agendamentos', icon: Calendar, roles: ['admin', 'reception', 'doctor'] },
    { name: 'Estoque', to: '/estoque', icon: Package, roles: ['admin', 'pharmacy'] },
    { name: 'Relatórios', to: '/relatorios', icon: FileText, roles: ['admin', 'reception'] },
  ].filter(item => {
    if (currentUserRole === 'pharmacy') return item.name === 'Dashboard' || item.name === 'Estoque';
    if (!item.roles) return true;
    return item.roles.includes(currentUserRole);
  });

  return (
    <nav className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 gap-8 flex-shrink-0">
      <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-white mb-4">
        <span className="font-bold text-2xl">+</span>
      </div>
      
      <div className="flex flex-col gap-6 text-gray-400">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            title={item.name}
            className={({ isActive }) =>
              cn(
                'p-2 rounded-lg transition-colors cursor-pointer',
                isActive 
                  ? 'bg-primary-50 text-primary-600' 
                  : 'hover:text-gray-600 hover:bg-gray-50'
              )
            }
          >
            <item.icon className="w-6 h-6 flex-shrink-0" />
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

