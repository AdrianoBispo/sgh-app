import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { LogOut, Menu, Moon, Sun } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Modal } from '../ui/Modal';
import { APP_NAME, ROLE_NAMES, pageTitle } from '../../lib/navigation';
import { useTheme } from '../../lib/theme';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { currentUserRole, user, logout } = useAppContext();
  const location = useLocation();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const { isDark, toggle } = useTheme();

  const { title, subtitle } = pageTitle(location.pathname);
  const userDisplayName = user?.displayName || user?.email?.split('@')[0] || 'Usuário';
  const initials = userDisplayName.slice(0, 2);

  return (
    <header className="flex shrink-0 items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Abrir menu de navegação"
          className="rounded-xl border border-gray-200 bg-white p-2 text-gray-600 shadow-sm transition hover:bg-gray-50 lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-gray-800">{title}</h1>
          <p className="mt-1 truncate text-sm text-gray-500">{subtitle}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsConfigOpen(true)}
        aria-label="Abrir configurações e perfil"
        className="flex shrink-0 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left shadow-sm transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:px-4"
      >
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-8 w-8 rounded-full" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold uppercase text-emerald-700">
            {initials}
          </div>
        )}
        <div className="hidden pr-1 text-sm md:block">
          <p className="mb-1 max-w-[140px] truncate font-medium leading-none text-gray-700">{userDisplayName}</p>
          <p className="text-xs leading-none text-gray-400">{ROLE_NAMES[currentUserRole]}</p>
        </div>
      </button>

      <Modal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        title="Configurações e perfil"
        description={`${APP_NAME} — preferências desta conta`}
      >
        <div className="space-y-6">
          <div className="flex items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-full" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-2xl font-bold uppercase text-emerald-700 shadow-inner">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-lg font-bold text-gray-900">{user?.displayName || userDisplayName}</h3>
              <p className="truncate text-sm font-medium text-gray-600">{user?.email}</p>
              <span className="mt-1 inline-block rounded-full border border-primary-200 bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
                {ROLE_NAMES[currentUserRole]}
              </span>
            </div>
          </div>

          <section>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-800">Aparência</h4>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3">
                {isDark ? (
                  <Moon className="h-5 w-5 text-gray-600" aria-hidden="true" />
                ) : (
                  <Sun className="h-5 w-5 text-amber-500" aria-hidden="true" />
                )}
                <div>
                  <p className="font-medium text-gray-800">Tema do sistema</p>
                  <p className="text-xs text-gray-500">Alternar entre claro e escuro</p>
                </div>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <span className="sr-only">Ativar tema escuro</span>
                <input type="checkbox" className="peer sr-only" checked={isDark} onChange={toggle} />
                <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500" />
              </label>
            </div>
          </section>

          <section>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-800">Sessão</h4>
            <button
              type="button"
              onClick={() => {
                setIsConfigOpen(false);
                void logout();
              }}
              className="flex w-full items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 font-medium text-red-700 shadow-sm transition hover:bg-red-100"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
              Sair do sistema
            </button>
          </section>
        </div>
      </Modal>
    </header>
  );
}
