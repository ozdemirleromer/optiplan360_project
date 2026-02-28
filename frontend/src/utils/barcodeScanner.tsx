/**
 * Barcode & QR Code System
 * Fiziksel takip ve tarayıcı entegrasyonu
 */

import React, { useState, useCallback } from 'react';
import { Camera, X } from 'lucide-react';

export interface BarcodeLabel {
  type: '1d' | '2d'; // 1D: Code128, 2D: QR
  entityType: string; // 'order', 'station', etc.
  entityId: string;
  entityName: string;
  dimension?: {
    width: number; // mm
    height: number; // mm
  };
  qrData?: Record<string, unknown>; // QR code'a embed edilecek veri
}

/**
 * Barcode Scan Service
 */
export const barcodeService = {
  /**
   * Kamerayı başlat ve QR'ı taray
   */
  startScanning: async (onScan: (data: Record<string, unknown>) => void): Promise<() => void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      // jsQR library gerek
      const canvas = document.createElement('canvas');
      const canvasContext = canvas.getContext('2d')!;
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      let scanning = true;
      const scanFrame = () => {
        if (!scanning) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);

          // jsQR nalı basit QR decode
          canvasContext.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          );

          // Simple QR detection (would need jsQR library for full impl)
          onScan({ data: 'scanned-data' });
        }
        if (scanning) {
          setTimeout(scanFrame, 500);
        }
      };
      setTimeout(scanFrame, 500);

      return () => {
        scanning = false;
        stream.getTracks().forEach((track) => track.stop());
      };
    } catch (error) {
      console.error('Barcode scanning error:', error);
      throw error;
    }
  },

  /**
   * Barkod/QR etiket oluştur ve indir
   */
  generateLabel: async (
    label: BarcodeLabel,
    _format: 'pdf' | 'png' = 'pdf',
  ): Promise<Blob> => {
    try {
      const response = await fetch('/api/barcode/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(label),
      });

      if (!response.ok) {
        throw new Error('Label generation failed');
      }

      return await response.blob();
    } catch (error) {
      console.error('Label generation error:', error);
      throw error;
    }
  },

  /**
   * Toplu etiket oluştur (batch)
   */
  generateBatchLabels: async (
    labels: BarcodeLabel[],
    format: 'pdf' | 'zip' = 'pdf',
  ): Promise<Blob> => {
    try {
      const response = await fetch('/api/barcode/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels, format }),
      });

      if (!response.ok) {
        throw new Error('Batch generation failed');
      }

      return await response.blob();
    } catch (error) {
      console.error('Batch generation error:', error);
      throw error;
    }
  },

  /**
   * Yazıcıya gönder
   */
  printLabel: async (label: BarcodeLabel) => {
    try {
      const blob = await barcodeService.generateLabel(label, 'pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `label-${label.entityId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Print error:', error);
      throw error;
    }
  },
};

/**
 * useBarcodeScanner Hook
 */
export const useBarcodeScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<{
    data: string;
    [key: string]: unknown;
  } | null>(null);

  const startScanning = useCallback(
    async (onScan?: (data: Record<string, unknown>) => void) => {
      setIsScanning(true);
      try {
        const stop = await barcodeService.startScanning((data) => {
          const value = typeof data.data === "string" ? data.data : String(data.data ?? "");
          setLastScanned({ ...data, data: value });
          if (onScan) onScan(data);
        });

        return stop;
      } finally {
        setIsScanning(false);
      }
    },
    [],
  );

  const stopScanning = useCallback(() => {
    setIsScanning(false);
  }, []);

  return { isScanning, lastScanned, startScanning, stopScanning };
};

/**
 * Barcode Scanner Component
 */
interface BarcodeScannerProps {
  onScan: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onScan, onClose }) => {
  const { lastScanned, startScanning, stopScanning } = useBarcodeScanner();

  React.useEffect(() => {
    let stop: (() => void) | null = null;

    (async () => {
      stop = await startScanning(onScan);
    })();

    return () => {
      if (stop) stop();
      stopScanning();
    };
  }, [startScanning, stopScanning, onScan]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-gray-900">
        <h2 className="text-white font-semibold">Barkod Taray</h2>
        <button
          onClick={onClose}
          className="text-white hover:text-gray-300"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-300 mb-4">Barkodu kameraya göster</p>

          {lastScanned && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
              <p className="font-semibold text-green-900">Tarandı!</p>
              <p className="text-sm text-green-700">{String(lastScanned.data)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
