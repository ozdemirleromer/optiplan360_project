import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
     ChatBubbleLeftRightIcon,
     PlusIcon,
     PaperAirplaneIcon,
     ClockIcon,
     LifebuoyIcon
} from '@heroicons/react/24/outline';

interface TicketMessage {
     id: string;
     sender_name: string;
     message: string;
     created_at: string;
     sender_id: number;
}

interface Ticket {
     id: string;
     subject: string;
     description: string;
     status: string;
     priority: string;
     created_at: string;
     updated_at: string;
     messages: TicketMessage[];
}

export default function Support() {
     const [tickets, setTickets] = useState<Ticket[]>([]);
     const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
     const [loading, setLoading] = useState(true);
     const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);

     // New ticket form
     const [subject, setSubject] = useState('');
     const [description, setDescription] = useState('');
     const [priority, setPriority] = useState('NORMAL');

     // Reply form
     const [replyMessage, setReplyMessage] = useState('');

     const { user } = useAuthStore();

     const fetchTickets = async () => {
          try {
               const response = await api.get('/api/v1/portal/tickets');
               setTickets(response.data);
          } catch (err) {
               console.error("Destek talepleri alınamadı", err);
          } finally {
               setLoading(false);
          }
     };

     const fetchTicketDetail = async (id: string) => {
          try {
               const response = await api.get(`/api/v1/portal/tickets/${id}`);
               setSelectedTicket(response.data);
          } catch (err) {
               console.error("Talep detayı alınamadı", err);
          }
     };

     useEffect(() => {
          fetchTickets();
     }, []);

     const handleCreateTicket = async (e: React.FormEvent) => {
          e.preventDefault();
          try {
               const res = await api.post('/api/v1/portal/tickets', {
                    subject,
                    description,
                    priority
               });
               setTickets([res.data, ...tickets]);
               setIsNewTicketOpen(false);
               setSubject('');
               setDescription('');
               setSelectedTicket(res.data);
          } catch (err) {
               console.error("Talep oluşturulamadı", err);
          }
     };

     const handleSendReply = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!selectedTicket || !replyMessage.trim()) return;

          try {
               await api.post(`/api/v1/portal/tickets/${selectedTicket.id}/reply`, {
                    message: replyMessage
               });
               setReplyMessage('');
               // Refresh ticket details to get new messages
               await fetchTicketDetail(selectedTicket.id);
               await fetchTickets(); // Listeyi de güncelle ki son işlem tarihi değişsin
          } catch (err) {
               console.error("Yanıt gönderilemedi", err);
          }
     };

     const getStatusBadge = (status: string) => {
          switch (status) {
               case 'OPEN': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Açık</span>;
               case 'IN_PROGRESS': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">İşlemde</span>;
               case 'RESOLVED': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Çözümlendi</span>;
               case 'CLOSED': return <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Kapatıldı</span>;
               default: return null;
          }
     };

     if (loading) return <div className="text-gray-500">Destek verileriniz yükleniyor...</div>;

     return (
          <div className="flex h-[calc(100vh-8rem)] gap-6">
               {/* Left Column - Ticket List */}
               <div className="w-1/3 flex flex-col bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                         <h2 className="text-lg font-semibold text-gray-900">Destek Taleplerim</h2>
                         <button
                              onClick={() => { setIsNewTicketOpen(true); setSelectedTicket(null); }}
                              className="p-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                              title="Yeni Talep Oluştur"
                         >
                              <PlusIcon className="w-5 h-5" />
                         </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                         {tickets.length === 0 ? (
                              <div className="p-8 text-center text-gray-500">
                                   <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                                   <p>Henüz bir destek talebiniz bulunmuyor.</p>
                              </div>
                         ) : (
                              <ul className="divide-y divide-gray-100">
                                   {tickets.map(ticket => (
                                        <li
                                             key={ticket.id}
                                             onClick={() => { setIsNewTicketOpen(false); fetchTicketDetail(ticket.id); }}
                                             className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${selectedTicket?.id === ticket.id ? 'bg-primary-50 border-l-4 border-primary-500' : ''}`}
                                        >
                                             <div className="flex justify-between items-start mb-1">
                                                  <h3 className="text-sm font-medium text-gray-900 line-clamp-1 pr-2">{ticket.subject}</h3>
                                                  {getStatusBadge(ticket.status)}
                                             </div>
                                             <div className="flex items-center text-xs text-gray-500 mt-2">
                                                  <ClockIcon className="w-4 h-4 mr-1" />
                                                  <span>{new Date(ticket.updated_at).toLocaleDateString('tr-TR')}</span>
                                             </div>
                                        </li>
                                   ))}
                              </ul>
                         )}
                    </div>
               </div>

               {/* Right Column - Detail / Create Form */}
               <div className="flex-1 flex flex-col bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden relative">
                    {isNewTicketOpen ? (
                         <div className="p-8 h-full overflow-y-auto">
                              <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b pb-4">Yeni Destek Talebi Oluştur</h2>
                              <form onSubmit={handleCreateTicket} className="space-y-6 max-w-2xl">
                                   <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Konu Başlığı</label>
                                        <input
                                             type="text"
                                             required
                                             value={subject}
                                             onChange={e => setSubject(e.target.value)}
                                             className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2.5 border"
                                             placeholder="Satış, Arıza, Eksik Ürün vb."
                                        />
                                   </div>
                                   <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Öncelik Derecesi</label>
                                        <select
                                             value={priority}
                                             onChange={e => setPriority(e.target.value)}
                                             className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-2.5 border"
                                        >
                                             <option value="LOW">Düşük</option>
                                             <option value="NORMAL">Normal</option>
                                             <option value="HIGH">Yüksek</option>
                                             <option value="URGENT">Acil</option>
                                        </select>
                                   </div>
                                   <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Talep Detayı</label>
                                        <textarea
                                             required
                                             rows={6}
                                             value={description}
                                             onChange={e => setDescription(e.target.value)}
                                             className="w-full border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 sm:text-sm p-3 border resize-none"
                                             placeholder="Lütfen yaşadığınız sorunu veya talebinizi detaylıca açıklayınız."
                                        />
                                   </div>
                                   <div className="flex justify-end gap-3">
                                        <button
                                             type="button"
                                             onClick={() => setIsNewTicketOpen(false)}
                                             className="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                                        >
                                             İptal
                                        </button>
                                        <button
                                             type="submit"
                                             className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                                        >
                                             Talebi Gönder
                                        </button>
                                   </div>
                              </form>
                         </div>
                    ) : selectedTicket ? (
                         <div className="flex flex-col h-full">
                              {/* Ticket Header */}
                              <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                   <div className="flex justify-between items-start">
                                        <div>
                                             <h2 className="text-xl font-bold text-gray-900 mb-2">{selectedTicket.subject}</h2>
                                             <p className="text-sm text-gray-500 block max-w-2xl">{selectedTicket.description}</p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                             {getStatusBadge(selectedTicket.status)}
                                             <span className="text-xs text-gray-400">Tarih: {new Date(selectedTicket.created_at).toLocaleString('tr-TR')}</span>
                                        </div>
                                   </div>
                              </div>

                              {/* Message History */}
                              <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-gray-50/30">
                                   {selectedTicket.messages?.map(msg => {
                                        const isMe = msg.sender_id === user?.id;
                                        return (
                                             <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                                  <div className={`max-w-[75%] rounded-2xl px-5 py-3 ${isMe ? 'bg-brand-accent text-white rounded-br-none' : 'bg-white border text-gray-800 rounded-bl-none shadow-sm'}`}>
                                                       <div className={`text-xs font-medium mb-1 ${isMe ? 'text-blue-100' : 'text-gray-500'}`}>
                                                            {isMe ? 'Siz' : msg.sender_name || 'Destek Ekibi'}
                                                            <span className="ml-2 opacity-75">{new Date(msg.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                       </div>
                                                       <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.message}</p>
                                                  </div>
                                             </div>
                                        );
                                   })}
                                   {(!selectedTicket.messages || selectedTicket.messages.length === 0) && (
                                        <div className="text-center text-sm text-gray-400 mt-10">Henüz hiç yanıt verilmemiş. Müşteri temsilciniz en kısa sürede dönüş yapacaktır.</div>
                                   )}
                              </div>

                              {/* Reply Input Box */}
                              {selectedTicket.status !== 'CLOSED' ? (
                                   <div className="p-4 border-t border-gray-200 bg-white">
                                        <form onSubmit={handleSendReply} className="flex gap-3 items-end">
                                             <div className="flex-1">
                                                  <textarea
                                                       rows={2}
                                                       value={replyMessage}
                                                       onChange={(e) => setReplyMessage(e.target.value)}
                                                       placeholder="Bir yanıt yazın..."
                                                       className="w-full border-gray-300 rounded-lg shadow-sm focus:ring-brand-accent focus:border-brand-accent sm:text-sm p-3 border resize-none"
                                                       onKeyDown={(e) => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                 e.preventDefault();
                                                                 handleSendReply(e);
                                                            }
                                                       }}
                                                  />
                                             </div>
                                             <button
                                                  type="submit"
                                                  disabled={!replyMessage.trim()}
                                                  className="inline-flex items-center p-3 border border-transparent rounded-lg shadow-sm text-white bg-brand-accent hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent disabled:opacity-50 disabled:cursor-not-allowed mb-0.5"
                                             >
                                                  <PaperAirplaneIcon className="h-5 w-5 transform -rotate-45" aria-hidden="true" />
                                             </button>
                                        </form>
                                   </div>
                              ) : (
                                   <div className="p-4 border-t border-gray-200 bg-gray-50 text-center text-sm text-gray-500">
                                        Bu destek talebi kapatılmıştır. Yeni bir konunuz varsa lütfen yeni talep oluşturunuz.
                                   </div>
                              )}
                         </div>
                    ) : (
                         <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                              <LifebuoyIcon className="w-16 h-16 text-gray-200 mb-4" />
                              <p className="text-lg font-medium text-gray-500">Detayları görmek için listeden bir talep seçin</p>
                              <p className="text-sm mt-2">veya yeni bir destek talebi oluşturun.</p>
                         </div>
                    )}
               </div>
          </div>
     );
}
