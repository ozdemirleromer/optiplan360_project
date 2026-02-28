/**
 * Auto-Save Hook
 * Form verilerini localStorage'a otomatik kaydet
 * @example
 *   const { isDraft, lastSaved } = useAutoSave(formData, 'order-editor');
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { notificationHelpers } from '../stores/notificationStore';

interface AutoSaveOptions {
  key: string;
  delay?: number; // Debounce delay (default 2000ms)
  version?: number; // Data version for compatibility
  onSave?: (data: unknown) => void;
  onRestore?: (data: unknown) => boolean; // Return false to skip restoration
}

/**
 * useAutoSave Hook
 */
export const useAutoSave = <T extends Record<string, unknown>>(
  data: T,
  options: AutoSaveOptions,
) => {
  const {
    key,
    delay = 2000,
    version = 1,
    onSave,
    onRestore,
  } = options;

  const [isDraft, setIsDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDataRef = useRef<T>(data);

  // Veriyi localStorage'a kaydet
  const save = useCallback(() => {
    try {
      const draft = {
        data,
        version,
        timestamp: new Date().toISOString(),
      };

      localStorage.setItem(key, JSON.stringify(draft));
      setIsDraft(true);
      setLastSaved(new Date().toLocaleTimeString('tr-TR'));
      setHasError(false);

      if (onSave) {
        onSave(data);
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      setHasError(true);
      notificationHelpers.error('Taslak kaydedilemedi', 'localStorage quota aşmış olabilir');
    }
  }, [data, key, version, onSave]);

  // Debounced save
  useEffect(() => {
    if (JSON.stringify(data) === JSON.stringify(lastDataRef.current)) {
      return; // No changes
    }

    lastDataRef.current = data;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      save();
    }, delay);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay, save]);

  // Taslağı localStorage'dan yükle
  const restoreDraft = useCallback((): T | null => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const { data: draftData, version: storedVersion } = JSON.parse(stored);

      if (storedVersion !== version) {
        console.warn('Draft version mismatch, ignoring');
        return null;
      }

      if (onRestore) {
        const shouldRestore = onRestore(draftData);
        if (!shouldRestore) {
          return null;
        }
      }

      return draftData;
    } catch (error) {
      console.error('Failed to restore draft:', error);
      return null;
    }
  }, [key, version, onRestore]);

  // Taslağı sil
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setIsDraft(false);
      setLastSaved(null);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, [key]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isDraft,
    lastSaved,
    hasError,
    save,
    restoreDraft,
    clearDraft,
  };
};

/**
 * useDraftRecovery Hook
 * Sayfa yükleme sırasında draft varsa sor
 */
export const useDraftRecovery = (key: string) => {
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [draftData, setDraftData] = useState<unknown>(null);

  const checkDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const { data } = JSON.parse(stored);
        setDraftData(data);
        setShowRecoveryDialog(true);
      }
    } catch (error) {
      console.error('Failed to check draft:', error);
    }
  }, [key]);

  const recoverDraft = useCallback(() => {
    return draftData;
  }, [draftData]);

  const discardDraft = useCallback(() => {
    localStorage.removeItem(key);
    setShowRecoveryDialog(false);
    setDraftData(null);
  }, [key]);

  return {
    showRecoveryDialog,
    draftData,
    checkDraft,
    recoverDraft,
    discardDraft,
  };
};

/**
 * Draft Recovery Modal
 */
interface DraftRecoveryModalProps {
  isOpen: boolean;
  onRecover: () => void;
  onDiscard: () => void;
  timestamp?: string;
}

export const DraftRecoveryModal: React.FC<DraftRecoveryModalProps> = ({
  isOpen,
  onRecover,
  onDiscard,
  timestamp,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-900">Taslak Kaydı Bulundu</h2>
        </div>

        <p className="text-gray-600 mb-2">
          Önceki oturumunuzda kaydettiğiniz bir taslak bulundu.
        </p>

        {timestamp && (
          <p className="text-sm text-gray-500 mb-4">
            Son kayıt: {new Date(timestamp).toLocaleString('tr-TR')}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onDiscard}
            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Sil
          </button>

          <button
            onClick={onRecover}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Geri Yükle
          </button>
        </div>
      </div>
    </div>
  );
};
