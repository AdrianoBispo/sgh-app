import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import * as AppContextModule from '../../context/AppContext';

vi.mock('../../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Sidebar component role-based navigation rendering', () => {
  it('renders all links for admin role', () => {
    vi.mocked(AppContextModule.useAppContext).mockReturnValue({
      currentUserRole: 'admin',
    } as any);

    renderWithRouter(<Sidebar />);

    expect(screen.getByTitle('Dashboard')).toBeInTheDocument();
    expect(screen.getByTitle('Pacientes')).toBeInTheDocument();
    expect(screen.getByTitle('Agendamentos')).toBeInTheDocument();
    expect(screen.getByTitle('Estoque')).toBeInTheDocument();
    expect(screen.getByTitle('Relatórios')).toBeInTheDocument();
    expect(screen.getByTitle('Usuários')).toBeInTheDocument();
  });

  it('renders specific links for reception role', () => {
    vi.mocked(AppContextModule.useAppContext).mockReturnValue({
      currentUserRole: 'reception',
    } as any);

    renderWithRouter(<Sidebar />);

    expect(screen.getByTitle('Dashboard')).toBeInTheDocument();
    expect(screen.getByTitle('Pacientes')).toBeInTheDocument();
    expect(screen.getByTitle('Agendamentos')).toBeInTheDocument();
    expect(screen.getByTitle('Relatórios')).toBeInTheDocument();
    
    // Restricted links
    expect(screen.queryByTitle('Usuários')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Estoque')).not.toBeInTheDocument();
  });

  it('renders specific links for doctor role', () => {
    vi.mocked(AppContextModule.useAppContext).mockReturnValue({
      currentUserRole: 'doctor',
    } as any);

    renderWithRouter(<Sidebar />);

    expect(screen.getByTitle('Dashboard')).toBeInTheDocument();
    expect(screen.getByTitle('Pacientes')).toBeInTheDocument();
    expect(screen.getByTitle('Agendamentos')).toBeInTheDocument();
    
    // Restricted links
    expect(screen.queryByTitle('Usuários')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Estoque')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Relatórios')).not.toBeInTheDocument();
  });

  it('renders specific links for pharmacy role', () => {
    vi.mocked(AppContextModule.useAppContext).mockReturnValue({
      currentUserRole: 'pharmacy',
    } as any);

    renderWithRouter(<Sidebar />);

    expect(screen.getByTitle('Dashboard')).toBeInTheDocument();
    expect(screen.getByTitle('Estoque')).toBeInTheDocument();
    
    // Restricted links
    expect(screen.queryByTitle('Pacientes')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Usuários')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Agendamentos')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Relatórios')).not.toBeInTheDocument();
  });
});
