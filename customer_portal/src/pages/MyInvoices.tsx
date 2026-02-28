import { useState, useEffect } from 'react';
import api from '../services/api';
import { DocumentArrowDownIcon } from '@heroicons/react/24/outline';

interface Invoice {
     id: string;
     invoice_number: string;
     issue_date: string;
     due_date: string | null;
     total_amount: number;
     currency: string;
     status: string;
     pdf_url: string | null;
}

export default function MyInvoices() {
     const [invoices, setInvoices] = useState<Invoice[]>([]);
     const [loading, setLoading] = useState(true);

     useEffect(() => {
          const fetchInvoices = async () => {
               try {
                    const response = await api.get('/api/v1/portal/invoices');
                    setInvoices(response.data);
               } catch (err) {
                    console.error("Faturalar alınamadı", err);
               } finally {
                    setLoading(false);
               }
          };
          fetchInvoices();
     }, []);

     const getStatusColor = (status: string) => {
          if (status === 'PAID') return 'text-green-700 bg-green-50 ring-green-600/20';
          if (status === 'OVERDUE') return 'text-red-700 bg-red-50 ring-red-600/10';
          return 'text-yellow-800 bg-yellow-50 ring-yellow-600/20'; // UNPAID
     };

     const getStatusText = (status: string) => {
          if (status === 'PAID') return 'Ödendi';
          if (status === 'OVERDUE') return 'Gecikmiş';
          return 'Ödenmemiş';
     };

     if (loading) return <div className="text-gray-500">Fatura verileriniz yükleniyor...</div>;

     return (
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
               <div className="border-b border-gray-200 px-4 py-5 sm:px-6">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">Faturalar ve Hesap Ekstresi</h3>
               </div>
               <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300">
                         <thead className="bg-gray-50">
                              <tr>
                                   <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Fatura No</th>
                                   <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tarih</th>
                                   <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Vade</th>
                                   <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Tutar</th>
                                   <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Durum</th>
                                   <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 whitespace-nowrap">
                                        <span className="sr-only">İndir</span>
                                   </th>
                              </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-200 bg-white">
                              {invoices.length === 0 ? (
                                   <tr>
                                        <td colSpan={6} className="py-8 text-center text-sm text-gray-500">Henüz kesilmiş bir faturanız bulunmuyor.</td>
                                   </tr>
                              ) : (
                                   invoices.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                                             <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                  {inv.invoice_number}
                                             </td>
                                             <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                  {new Date(inv.issue_date).toLocaleDateString('tr-TR')}
                                             </td>
                                             <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                  {inv.due_date ? new Date(inv.due_date).toLocaleDateString('tr-TR') : '-'}
                                             </td>
                                             <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                                                  {inv.total_amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {inv.currency}
                                             </td>
                                             <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                  <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${getStatusColor(inv.status)}`}>
                                                       {getStatusText(inv.status)}
                                                  </span>
                                             </td>
                                             <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                  {inv.pdf_url ? (
                                                       <a href={inv.pdf_url} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-900 inline-flex items-center">
                                                            <DocumentArrowDownIcon className="w-5 h-5 mr-1" />
                                                            PDF İndir
                                                       </a>
                                                  ) : (
                                                       <span className="text-gray-400 text-xs italic">PDF Yok</span>
                                                  )}
                                             </td>
                                        </tr>
                                   ))
                              )}
                         </tbody>
                    </table>
               </div>
          </div>
     );
}
