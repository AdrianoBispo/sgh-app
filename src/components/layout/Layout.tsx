import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Fecha a gaveta ao trocar de página no mobile.
  useEffect(() => setIsSidebarOpen(false), [location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">
      <Sidebar isOpen={isSidebarOpen} onNavigate={() => setIsSidebarOpen(false)} />

      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-4 md:p-8">
        <Header onToggleSidebar={() => setIsSidebarOpen((open) => !open)} />
        <main className="flex flex-1 flex-col overflow-y-auto pt-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
