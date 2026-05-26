import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden p-4 md:p-8">
        <Header />
        <main className="flex-1 overflow-y-auto flex flex-col pt-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
