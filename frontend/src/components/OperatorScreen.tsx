import React, { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { adminService } from '../services/adminService';

const OperatorScreen = () => {
    const [orderId, setOrderId] = useState('');
    const [partId, setPartId] = useState('');
    const [message, setMessage] = useState('');
    const [messageSuccess, setMessageSuccess] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(false);

    const handleScan = async () => {
        if (!orderId || !partId) {
            setMessage('Lütfen Sipariş ID ve Parça ID girin');
            setMessageSuccess(false);
            return;
        }

        try {
            setLoading(true);
            setMessage('Tarama işlemi yapılıyor...');
            setMessageSuccess(null);

            // API çağrısı - adminService üzerinden station scan
            const result = await adminService.scanStation({
                order_id: orderId,
                part_id: partId,
                station_id: 1,
                scan_type: 'PRODUCTION_SCAN',
                timestamp: new Date().toISOString(),
            });

            setMessage(`Parça ${partId} başarıyla güncellendi. ${result.message || ''}`);
            setMessageSuccess(true);
            
            // Formu temizle
            setOrderId('');
            setPartId('');
            
            setTimeout(() => { setMessage(''); setMessageSuccess(null); }, 5000);
        } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : 'Beklenmeyen hata';
            setMessage(`Hata: ${errorMsg}`);
            setMessageSuccess(false);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleScan();
        }
    };

    return (
        <div className="container mx-auto p-4 border rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold mb-4">Operatör Tarama Ekranı</h2>
            <div className="flex flex-col space-y-4">
                <input 
                    type="text" 
                    placeholder="Sipariş ID" 
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                    className="p-2 border rounded disabled:opacity-50"
                />
                <input 
                    type="text" 
                    placeholder="Parça ID" 
                    value={partId}
                    onChange={(e) => setPartId(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                    className="p-2 border rounded disabled:opacity-50"
                    autoFocus
                />
                <button 
                    onClick={handleScan}
                    disabled={loading}
                    className="bg-blue-500 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 px-4 rounded"
                >
                    {loading ? 'Taranıyor...' : 'Tara'}
                </button>
            </div>
            {message && (
                <p className={`mt-4 text-lg font-semibold flex items-center gap-2 ${messageSuccess === true ? 'text-green-600' : 'text-red-600'}`}>
                    {messageSuccess === true ? <CheckCircle2 size={20} aria-hidden /> : messageSuccess === false ? <XCircle size={20} aria-hidden /> : null}
                    {message}
                </p>
            )}
        </div>
    );
};

export default OperatorScreen;
