/**
 * Confirmation Dialog Component
 * Kritik işlemler için onay penceresi
 * @example
 *   const { confirm } = useConfirmation();
 *   if (await confirm({ title: 'Sil?', message: 'Emin misin?' })) {
 *     deleteOrder(id);
 *   }
 */

import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, AlertCircle } from 'lucide-react';

export interface ConfirmationOptions {
  title: string;
  message: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info'; // danger = red, warning = yellow, info = blue
  icon?: 'trash' | 'warning' | 'info';
  centered?: boolean;
}

interface ConfirmationState extends ConfirmationOptions {
  isOpen: boolean;
  onResolve?: (confirmed: boolean) => void;
}

// Global confirmation hook
let globalConfirmationState: ConfirmationState = { isOpen: false, title: '', message: '' };
let updateGlobalConfirmation: ((state: ConfirmationState) => void) | null = null;

export const useConfirmation = () => {
  const confirm = (options: ConfirmationOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      if (updateGlobalConfirmation) {
        updateGlobalConfirmation({
          ...options,
          isOpen: true,
          confirmText: options.confirmText || 'Evet',
          cancelText: options.cancelText || 'Hayır',
          type: options.type || 'warning',
          onResolve: (confirmed) => {
            resolve(confirmed);
          },
        });
      }
    });
  };

  return { confirm };
};

// Context for global confirmation dialog
const ConfirmationContext = React.createContext<{
  state: ConfirmationState;
  setState: (state: ConfirmationState) => void;
} | null>(null);

export const ConfirmationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ConfirmationState>(globalConfirmationState);

  React.useEffect(() => {
    globalConfirmationState = state;
    updateGlobalConfirmation = setState;
  }, [state]);

  return (
    <ConfirmationContext.Provider value={{ state, setState }}>
      {children}
      <ConfirmationDialog />
    </ConfirmationContext.Provider>
  );
};

const ConfirmationDialog: React.FC = () => {
  const context = React.useContext(ConfirmationContext);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  if (!context) return null;

  const { state, setState } = context;

  const handleConfirm = () => {
    if (state.onResolve) {
      state.onResolve(true);
    }
    setState({ ...state, isOpen: false });
  };

  const handleCancel = () => {
    if (state.onResolve) {
      state.onResolve(false);
    }
    setState({ ...state, isOpen: false });
  };

  // ESC handler + focus trap + focus restore
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!state.isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    // İlk focusable elemente odaklan
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
    );
    if (focusables?.length) {
      setTimeout(() => focusables[focusables.length - 1]?.focus(), 0);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
        return;
      }
      if (e.key === "Tab" && focusables && focusables.length > 0) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isOpen]);

  if (!state.isOpen) return null;

  const iconMap = {
    trash: <Trash2 className="w-12 h-12 text-red-500" />,
    warning: <AlertTriangle className="w-12 h-12 text-yellow-500" />,
    info: <AlertCircle className="w-12 h-12 text-blue-500" />,
  };

  const colorMap = {
    danger: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      button: 'bg-red-600 hover:bg-red-700',
      text: 'text-red-800',
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      button: 'bg-yellow-600 hover:bg-yellow-700',
      text: 'text-yellow-800',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      button: 'bg-blue-600 hover:bg-blue-700',
      text: 'text-blue-800',
    },
  };

  const colors = colorMap[state.type || 'warning'];
  const icon = iconMap[state.icon || 'warning'];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          className={`
            ${colors.bg} border ${colors.border}
            rounded-lg shadow-2xl p-6 max-w-md w-full
            transform transition-all
          `}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
          aria-describedby="dialog-description"
        >
          {/* Icon */}
          <div className="flex justify-center mb-4">{icon}</div>

          {/* Title */}
          <h2
            id="dialog-title"
            className={`text-xl font-bold text-center mb-2 ${colors.text}`}
          >
            {state.title}
          </h2>

          {/* Message */}
          <p id="dialog-description" className="text-gray-700 text-center mb-2">
            {state.message}
          </p>

          {/* Description */}
          {state.description && (
            <p className="text-sm text-gray-600 text-center mb-6">{state.description}</p>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              {state.cancelText}
            </button>

            <button
              onClick={handleConfirm}
              className={`flex-1 ${colors.button} text-white font-semibold py-2 px-4 rounded-lg transition-colors`}
            >
              {state.confirmText}
            </button>
          </div>

          {/* Help text */}
          <p className="text-xs text-gray-500 text-center mt-4">
            İpucu: ESC tuşuna basarak iptal edebilirsiniz
          </p>
        </div>
      </div>
    </>
  );
};
