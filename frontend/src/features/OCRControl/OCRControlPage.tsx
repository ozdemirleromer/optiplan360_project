import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GlobalHeader } from './components/GlobalHeader';
import { OCRControlHeader } from './components/OCRControlHeader';
import { SplitWorkspace } from './components/SplitWorkspace';
import { BlockerActionBar } from './components/BlockerActionBar';
import { FaultyImageModal } from './components/FaultyImageModal';
import { OCRDataProvider } from './contexts/OCRDataContext';
import { useOCRData } from './contexts/OCRDataContext';
import { KeyboardNavigationProvider } from './contexts/KeyboardNavigationContext';
import { Toast } from './components/Toast';

export const OCRControlPage: React.FC = () => {
  return (
    <KeyboardNavigationProvider>
      <OCRDataProvider>
        <OCRControlPageContent />
      </OCRDataProvider>
    </KeyboardNavigationProvider>
  );
};

const OCRControlPageContent: React.FC = () => {
  const [isFaultyModalOpen, setIsFaultyModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const { actions } = useOCRData();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    actions.setEmpty();
  }, [actions]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      {/* Global Header */}
      <GlobalHeader />
      
      {/* OCR Control Header Band */}
      <OCRControlHeader 
        onFaultyImageClick={() => setIsFaultyModalOpen(true)}
        showToast={showToast}
      />
      
      {/* Main Split-Screen Workspace */}
      <SplitWorkspace showToast={showToast} />
      
      {/* Bottom Blocker / Action Bar */}
      <BlockerActionBar showToast={showToast} />
      
      {/* Faulty Image Modal */}
      {isFaultyModalOpen && (
        <FaultyImageModal 
          onClose={() => setIsFaultyModalOpen(false)}
          showToast={showToast}
        />
      )}
      
      {/* Toast Notifications */}
      {toast && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};