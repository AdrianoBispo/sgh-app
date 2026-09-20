import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronLeft, ChevronRight, HeartPulse } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { APP_NAME, APP_TAGLINE, navigationFor } from '../../lib/navigation';
import { cn } from '../../lib/utils';

const PIN_STORAGE_KEY = 'sidebar:pinned';

interface SidebarProps {
  /** Controla a gaveta em telas pequenas. */
  isOpen?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ isOpen = false, onNavigate }: SidebarProps) {
  const { currentUserRole } = useAppContext();
  const navigation = navigationFor(currentUserRole);

  const [pinned, setPinned] = useState(() => {
    try {
      return localStorage.getItem(PIN_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(PIN_STORAGE_KEY, String(pinned));
    } catch {
      // Preferência não persistida; o estado vale para esta sessão.
    }
  }, [pinned]);

  // Rótulos sempre visíveis no mobile (gaveta larga) e no modo fixado;
  // no modo compacto aparecem ao passar o mouse ou ao focar via teclado.
  const labelClass = cn(
    'whitespace-nowrap transition-opacity duration-200',
    pinned ? 'opacity-100' : 'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100',
  );

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'group fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col gap-6 overflow-hidden border-r border-gray-200 bg-white py-6',
        'transition-[width,transform] duration-300 ease-in-out lg:static lg:z-auto lg:translate-x-0',
        pinned ? 'lg:w-64' : 'lg:w-20 lg:hover:w-64 lg:focus-within:w-64',
        isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
      )}
    >
      <div className="mb-2 flex w-64 items-center gap-4 px-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center text-emerald-600">
          <HeartPulse className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className={cn('flex flex-col', labelClass)}>
          <span className="text-lg font-bold leading-tight text-gray-900">{APP_NAME}</span>
          <span className="text-xs font-medium tracking-wide text-gray-500">{APP_TAGLINE}</span>
        </div>
      </div>

      <div className="flex w-64 flex-col gap-2 px-3 text-gray-500">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            end={item.to === '/'}
            title={item.name}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-3 font-medium transition-all',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                isActive ? 'bg-primary-50 text-primary-700 shadow-sm' : 'hover:bg-gray-100 hover:text-gray-900',
              )
            }
          >
            <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
            <span className={cn('text-[15px]', labelClass)}>{item.name}</span>
          </NavLink>
        ))}
      </div>

      <div className="mt-auto hidden w-64 px-3 lg:block">
        <button
          type="button"
          onClick={() => setPinned((current) => !current)}
          aria-pressed={pinned}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {pinned ? (
            <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <span className={labelClass}>{pinned ? 'Recolher menu' : 'Fixar menu'}</span>
        </button>
      </div>
    </nav>
  );
}
