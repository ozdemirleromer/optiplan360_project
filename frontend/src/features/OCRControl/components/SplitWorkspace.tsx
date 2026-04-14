import React, { useState, useCallback, useRef } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { DocumentViewer } from './DocumentViewer';
import { OCRGrid } from './OCRGrid';
import { useOCRData } from '../contexts/OCRDataContext';
import { useKeyboardNavigation } from '../contexts/KeyboardNavigationContext';

interface SplitWorkspaceProps {
  showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export const SplitWorkspace: React.FC<SplitWorkspaceProps> = ({ showToast }) => {
  const { state } = useOCRData();
  const { state: keyboardState } = useKeyboardNavigation();
  const [panelSizes, setPanelSizes] = useState([50, 50]);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePanelResize = useCallback((sizes: number[]) => {
    setPanelSizes(sizes);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 bg-slate-900 overflow-hidden"
      style={{ height: 'calc(100vh - 14rem)' }}
    >
      <Group
        orientation="horizontal"
        className="h-full"
        onLayoutChange={handlePanelResize}
      >
        <Panel defaultSize={panelSizes[0]} minSize={30}>
          <DocumentViewer
            document={state.document}
            selectedField={keyboardState.selectedCell}
            showToast={showToast}
          />
        </Panel>

        <Separator className="bg-slate-700 hover:bg-slate-600 transition-colors">
          <div className="w-1 h-full bg-slate-600"></div>
        </Separator>

        <Panel defaultSize={panelSizes[1]} minSize={40}>
          <OCRGrid
            rows={state.rows}
            showToast={showToast}
          />
        </Panel>
      </Group>
    </div>
  );
};