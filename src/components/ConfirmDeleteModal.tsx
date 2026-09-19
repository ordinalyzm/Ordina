import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Удалить сообщение для всех?',
  description = 'Это сообщение будет безвозвратно удалено у всех участников чата.',
  confirmText = 'Удалить для всех',
  cancelText = 'Отмена',
  isDanger = true,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[20000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-6 relative flex flex-col items-center text-center space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDanger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
            <Trash2 size={28} />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 max-w-xs">{description}</p>
          </div>

          <div className="flex flex-col w-full gap-2 pt-2">
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-white transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 ${
                isDanger ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
              }`}
            >
              <Trash2 size={16} />
              <span>{confirmText}</span>
            </button>

            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs text-slate-500 hover:bg-slate-100 transition-colors"
            >
              {cancelText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
