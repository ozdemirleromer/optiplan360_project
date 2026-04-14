import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCw, Download } from 'lucide-react';
import { DocumentInfo, BoundingBox } from '../types';

interface DocumentViewerProps {
  document: DocumentInfo | null;
  selectedField: { rowId: string; fieldId: string } | null;
  showToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  selectedField,
  showToast
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [highlightedBbox, setHighlightedBbox] = useState<BoundingBox | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    setHighlightedBbox(null);
  }, [selectedField]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleReset = useCallback(() => {
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    setHighlightedBbox(null);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDownload = useCallback(() => {
    if (document?.imageUrl) {
      const link = document.createElement('a');
      link.href = document.imageUrl;
      link.download = document.name;
      link.click();
      showToast('Belge indiriliyor...', 'success');
    }
  }, [document, showToast]);

  if (!document) {
    return (
      <div className="h-full bg-slate-800 border-r border-slate-700 flex items-center justify-center">
        <p className="text-slate-400">Belge bulunamadı</p>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-800 border-r border-slate-700 flex flex-col">
      {/* Header */}
      <div className="bg-slate-700 border-b border-slate-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-slate-200">{document.name}</span>
          <span className="text-xs text-slate-400">
            Sayfa {document.currentPage} / {document.totalPages}
          </span>
        </div>
        
        {/* Zoom Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleZoomOut}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          
          <span className="text-xs text-slate-400 min-w-[3rem] text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          
          <button
            onClick={handleZoomIn}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          
          <div className="w-px h-4 bg-slate-600 mx-1"></div>
          
          <button
            onClick={handleReset}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="Reset View"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleDownload}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Document Viewer */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-hidden relative bg-slate-900"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `scale(${zoomLevel}) translate(${pan.x / zoomLevel}px, ${pan.y / zoomLevel}px)`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.2s ease-out'
          }}
        >
          {/* Document preview */}
          <div className="bg-white rounded shadow-lg" style={{ width: '600px', height: '800px' }}>
            <div className="p-8">
              <h2 className="text-2xl font-bold mb-4">Sipariş Formu</h2>
              
              {/* Preview form fields */}
              <div className="space-y-4">
                <div className="flex">
                  <span className="font-medium w-20">BOY:</span>
                  <span>120</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-20">EN:</span>
                  <span>80</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-20">ADET:</span>
                  <span>5</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-20">U1:</span>
                  <span>Metal</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-20">U2:</span>
                  <span>Siyah</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-20">K1:</span>
                  <span>Standart</span>
                </div>
                <div className="flex">
                  <span className="font-medium w-20">K2:</span>
                  <span>Premium</span>
                </div>
              </div>
            </div>
          </div>

          {/* BBox Highlights */}
          {highlightedBbox && (
            <div
              className="absolute border-2 border-yellow-400 bg-yellow-100 bg-opacity-20 pointer-events-none"
              style={{
                left: `${highlightedBbox.x}px`,
                top: `${highlightedBbox.y}px`,
                width: `${highlightedBbox.width}px`,
                height: `${highlightedBbox.height}px`,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)'
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
