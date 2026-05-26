import React, { ReactNode } from 'react';
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';

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
  confirmDisabled = false
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="flex flex-col p-2">
        <div className="flex items-start gap-4 mb-6">
          {isDestructive && (
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          )}
          <div className="text-gray-700 w-full pt-2">{message}</div>
        </div>
        <div className="flex justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition"
          >
            {cancelText}
          </button>
          <button 
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={confirmDisabled}
            className={`px-4 py-2 text-white rounded-xl font-medium transition ${
              confirmDisabled ? 'opacity-50 cursor-not-allowed ' : ''
            }${
              isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-gray-800'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}
