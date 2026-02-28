import { useState, useEffect } from 'react';
import api from '../services/api';

interface Order {
     id: string;
     status: string;
     thickness_mm: number;
     color: string;
     material_name: string;
     created_at: string;
     total_parts: number;
}

export default function MyOrders() {
     const [orders, setOrders] = useState<Order[]>([]);
     const [loading, setLoading] = useState(true);

     useEffect(() => {
          const fetchOrders = async () => {
               try {
                    const response = await api.get('/api/v1/portal/orders');
                    setOrders(response.data);
               } catch (err) {
                    console.error("Siparişler alınamadı", err);
               } finally {
                    setLoading(false);
               }
          };
          fetchOrders();
     }, []);

     const getStatusBadge = (status: string) => {
          switch (status) {
               case 'NEW':
                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Yeni Sipariş</span>;
               case 'IN_PRODUCTION':
                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">Üretimde</span>;
               case 'READY':
                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Teslimata Hazır</span>;
               case 'COMPLETED':
                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Tamamlandı/Teslim Edildi</span>;
               default:
                    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
          }
     };

     if (loading) return <div className="text-gray-500">Sipariş verileriniz yükleniyor...</div>;

     return (
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
               <div className="border-b border-gray-200 px-4 py-5 sm:px-6 flex justify-between items-center">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Aktif ve Geçmiş Siparişleriniz</h3>
               </div>
               <ul role="list" className="divide-y divide-gray-100">
                    {orders.length === 0 ? (
                         <li className="px-4 py-5 sm:px-6 text-sm text-gray-500">Henüz bir sipariş kaydınız bulunmuyor.</li>
                    ) : (
                         orders.map((order) => (
                              <li key={order.id} className="relative flex justify-between gap-x-6 px-4 py-5 hover:bg-gray-50 sm:px-6">
                                   <div className="flex min-w-0 gap-x-4">
                                        <div className="min-w-0 flex-auto">
                                             <p className="text-sm font-semibold leading-6 text-gray-900">
                                                  Sipariş #{order.id}
                                             </p>
                                             <p className="mt-1 flex text-xs leading-5 text-gray-500">
                                                  <span className="relative truncate">{order.material_name} - {order.color} ({order.thickness_mm}mm)</span>
                                             </p>
                                        </div>
                                   </div>
                                   <div className="flex shrink-0 items-center gap-x-4">
                                        <div className="hidden sm:flex sm:flex-col sm:items-end">
                                             <p className="text-sm leading-6 text-gray-900">{getStatusBadge(order.status)}</p>
                                             <p className="mt-1 text-xs leading-5 text-gray-500">
                                                  Tarih: {new Date(order.created_at).toLocaleDateString('tr-TR')}
                                             </p>
                                        </div>
                                   </div>
                              </li>
                         ))
                    )}
               </ul>
          </div>
     );
}
