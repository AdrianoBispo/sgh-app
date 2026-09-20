import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal component', () => {
  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Test Modal">
        <div>Modal Content</div>
      </Modal>,
    );
    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
  });

  it('renders correctly when isOpen is true', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Test Modal">
        <div>Modal Content</div>
      </Modal>,
    );
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal Content')).toBeInTheDocument();
  });

  it('expõe papel de diálogo e rótulo acessível', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Cadastro" description="Preencha os dados">
        <div>Conteúdo</div>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Cadastro');
    expect(dialog).toHaveAccessibleDescription('Preencha os dados');
  });

  it('calls onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('fecha ao pressionar Esc', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen onClose={handleClose} title="Test Modal">
        <div>Modal Content</div>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('trava a rolagem do fundo enquanto aberto e a devolve ao fechar', () => {
    const { unmount } = render(
      <Modal isOpen onClose={() => {}} title="Test Modal">
        <div>Modal Content</div>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('apenas o diálogo do topo responde ao Esc', () => {
    const closeBase = vi.fn();
    const closeTop = vi.fn();
    render(
      <>
        <Modal isOpen onClose={closeBase} title="Base">
          <div>Base</div>
        </Modal>
        <Modal isOpen onClose={closeTop} title="Topo">
          <div>Topo</div>
        </Modal>
      </>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(closeTop).toHaveBeenCalledTimes(1);
    expect(closeBase).not.toHaveBeenCalled();
  });
});
