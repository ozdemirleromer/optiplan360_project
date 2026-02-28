import { useState, useEffect } from 'react';
import api from '../services/api';
import {
     BuildingOfficeIcon,
     CurrencyDollarIcon,
     ShoppingCartIcon,
     CheckCircleIcon
} from '@heroicons/react/24/outline';

interface DashboardStats {
     active_orders_count: number;
     completed_orders_count: number;
     total_balance: number;
     currency: string;
}

export default function Dashboard() {
     const [stats, setStats] = useState<DashboardStats | null>(null);
     const [loading, setLoading] = useState(true);

     useEffect(() => {
          const fetchDashboard = async () => {
               try {
                    const response = await api.get('/api/v1/portal/dashboard');
                    setStats(response.data);
               } catch (err) {
                    console.error("Dashboard verileri alınamadı", err);
               } finally {
                    setLoading(false);
               }
          };
          fetchDashboard();
     }, []);

     if (loading) {
          return <div className="text-gray-500">Yükleniyor...</div>;
     }

     return (
          <div className="space-y-6">
               <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Bakiye Özeti */}
                    <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
                         <div className="p-5">
                              <div className="flex items-center">
                                   <div className="flex-shrink-0">
                                        <CurrencyDollarIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                                   </div>
                                   <div className="ml-5 w-0 flex-1">
                                        <dl>
                                             <dt className="text-sm font-medium text-gray-500 truncate">Mevcut Bakiye (Borç)</dt>
                                             <dd>
                                                  <div className="text-2xl font-bold text-gray-900">
                                                       {stats?.total_balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {stats?.currency}
                                                  </div>
                                             </dd>
                                        </dl>
                                   </div>
                              </div>
                         </div>
                    </div>

                    {/* Aktif Siparişler */}
                    <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
                         <div className="p-5">
                              <div className="flex items-center">
                                   <div className="flex-shrink-0">
                                        <ShoppingCartIcon className="h-6 w-6 text-primary-500" aria-hidden="true" />
                                   </div>
                                   <div className="ml-5 w-0 flex-1">
                                        <dl>
                                             <dt className="text-sm font-medium text-gray-500 truncate">Aktif Süren Siparişler</dt>
                                             <dd>
                                                  <div className="text-2xl font-bold text-gray-900">{stats?.active_orders_count}</div>
                                             </dd>
                                        </dl>
                                   </div>
                              </div>
                         </div>
                    </div>

                    {/* Tamamlananlar */}
                    <div className="bg-white overflow-hidden shadow rounded-lg border border-gray-100">
                         <div className="p-5">
                              <div className="flex items-center">
                                   <div className="flex-shrink-0">
                                        <CheckCircleIcon className="h-6 w-6 text-green-500" aria-hidden="true" />
                                   </div>
                                   <div className="ml-5 w-0 flex-1">
                                        <dl>
                                             <dt className="text-sm font-medium text-gray-500 truncate">Tamamlanan Siparişler</dt>
                                             <dd>
                                                  <div className="text-2xl font-bold text-gray-900">{stats?.completed_orders_count}</div>
                                             </dd>
                                        </dl>
                                   </div>
                              </div>
                         </div>
                    </div>
               </div>

               {/* Banner Area */}
               <div className="bg-primary-600 rounded-lg shadow-sm p-6 text-white flex items-center justify-between">
                    <div>
                         <h3 className="text-lg font-bold">Yeni Sipariş Mi İstiyorsunuz?</h3>
                         <p className="mt-1 text-primary-100 text-sm">B2B Müşteri temsilciniz ile görüşerek hemen yeni bir talep yaratabilirsiniz.</p>
                    </div>
                    <BuildingOfficeIcon className="h-12 w-12 text-primary-400 opacity-50" />
               </div>
          </div>
     );
}
