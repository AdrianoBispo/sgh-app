import { ReactNode } from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  confirmDisabled?: boolean;
  /** Bloqueia os botões enquanto a ação assíncrona termina. */
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  isDestructive = true,
  confirmDisabled = false,
  isLoading = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col">
        <div className="mb-6 flex items-start gap-4">
          {isDestructive && (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50">
              <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
            </div>
          )}
          <div className="w-full text-gray-700">{message}</div>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl bg-gray-100 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-200 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled || isLoading}
            className={cn(
              'rounded-xl px-4 py-2 font-medium text-white transition',
              confirmDisabled || isLoading ? 'cursor-not-allowed opacity-50' : '',
              isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700',
            )}
          >
            {isLoading ? 'Processando...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
