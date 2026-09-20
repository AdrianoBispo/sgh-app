import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Dashboard } from './Dashboard';
import { ToastProvider } from '../components/ui/Toast';
import * as AppContextModule from '../context/AppContext';
import { todayISO } from '../lib/date';

vi.mock('../context/AppContext', () => ({ useAppContext: vi.fn() }));

beforeAll(() => {
  // Recharts mede o contêiner; no jsdom todas as dimensões são zero.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});

const baseContext = {
  patients: [{ id: 'p1', name: 'Ana Lima', cpf: '529.982.247-25', birthDate: '1990-01-01', contact: '-', status: 'active' }],
  doctors: [{ id: 'd1', name: 'Dra. Ana Costa', crm: '54321-SP', specialty: 'Pediatria', contact: '-', availability: '-', status: 'active' }],
  appointments: [
    { id: 'a1', patientId: 'p1', doctorId: 'd1', type: 'Consulta', date: todayISO(), time: '09:00', status: 'Aguardando Atendimento' },
    { id: 'a2', patientId: 'p1', doctorId: 'd1', type: 'Exame', date: todayISO(), time: '10:00', status: 'Em Andamento' },
  ],
  inventory: [],
  saveAppointment: vi.fn(),
  isDataLoaded: true,
  currentUserRole: 'admin',
};

const renderDashboard = (overrides: Record<string, unknown> = {}) => {
  vi.mocked(AppContextModule.useAppContext).mockReturnValue({ ...baseContext, ...overrides } as never);
  return render(
    <ToastProvider>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </ToastProvider>,
  );
};

describe('Dashboard', () => {
  it('conta os atendimentos do dia por situação', () => {
    renderDashboard();
    expect(screen.getByText('Agendamentos hoje').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Aguardando atendimento').parentElement).toHaveTextContent('1');
    expect(screen.getByText('Em andamento').parentElement).toHaveTextContent('1');
  });

  it('exibe o alerta de estoque crítico (CT03.01)', () => {
    renderDashboard({
      inventory: [{ id: 'i1', name: 'Seringa 5ml', batch: 'L1', expiryDate: '2099-01-01', quantity: 5, minQuantity: 20, status: 'active' }],
    });
    expect(screen.getByText('Alerta de estoque crítico')).toBeInTheDocument();
    expect(screen.getByText('Seringa 5ml')).toBeInTheDocument();
  });

  it('exibe a mensagem de tranquilidade quando o estoque está regular (CT03.02)', () => {
    renderDashboard({
      inventory: [{ id: 'i1', name: 'Seringa 5ml', batch: 'L1', expiryDate: '2099-01-01', quantity: 500, minQuantity: 20, status: 'active' }],
    });
    expect(screen.getByText('Estoque dentro da margem')).toBeInTheDocument();
    expect(screen.queryByText('Alerta de estoque crítico')).not.toBeInTheDocument();
  });

  it('não mostra a agenda com dados de pacientes para a farmácia', () => {
    renderDashboard({ currentUserRole: 'pharmacy' });
    expect(screen.queryByText('Próximos atendimentos (hoje)')).not.toBeInTheDocument();
    expect(screen.queryByText('Ana Lima')).not.toBeInTheDocument();
    expect(screen.getByText('Estoque')).toBeInTheDocument();
  });

  it('não oferece a conclusão de atendimento para a recepção', () => {
    renderDashboard({ currentUserRole: 'reception' });
    expect(screen.getByText('Próximos atendimentos (hoje)')).toBeInTheDocument();
    expect(screen.queryByTitle(/Concluir atendimento/)).not.toBeInTheDocument();
  });
});
