// src/components/modals/DeleteModal.jsx
import { AlertCircle } from 'lucide-react';

export const DeleteModal = ({ isOpen, onClose, onConfirm, tradeTicker }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background-secondary rounded-xl p-6 w-full max-w-sm border border-border-primary shadow-xl">
        <div className="text-center">
          <div className="w-12 h-12 bg-danger/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-danger" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">Eliminar transacción</h3>
          <p className="text-text-tertiary mb-6">
            ¿Eliminar esta transacción de <span className="text-text-primary font-semibold font-mono">{tradeTicker}</span>?
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2.5 h-10 bg-background-tertiary text-text-secondary rounded-lg hover:bg-border-primary transition-colors font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-3 py-2.5 h-10 bg-danger text-white rounded-lg hover:bg-danger/90 transition-colors font-medium text-sm"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
