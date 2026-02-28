import { useState, useEffect } from 'react';
import { Card, Badge, Button } from '../../components/Shared';
import { crmService, CRMTicket } from '../../services/crmService';
import { useAuthStore } from '../../stores/authStore';
import {
     MessageSquare,
     Send,
     Clock,
     CheckCircle2,
     RefreshCw
} from 'lucide-react';

export default function SupportTickets() {
     const [tickets, setTickets] = useState<CRMTicket[]>([]);
     const [selectedTicket, setSelectedTicket] = useState<CRMTicket | null>(null);
     const [loading, setLoading] = useState(true);
     const [replyMessage, setReplyMessage] = useState('');

     // Fitreleme
     const [filterStatus, setFilterStatus] = useState<string>('');

     const { user } = useAuthStore();

     const loadTickets = async () => {
          try {
               setLoading(true);
               const data = await crmService.listTickets(filterStatus ? { status: filterStatus } : undefined);
               setTickets(data);
          } catch (err) {
               console.error("Biletler yüklenemedi", err);
          } finally {
               setLoading(false);
          }
     };

     const loadTicketDetail = async (id: string) => {
          try {
               const data = await crmService.getTicket(id);
               setSelectedTicket(data);
          } catch (err) {
               console.error("Bilet detayı alınamadı", err);
          }
     };

     useEffect(() => {
          loadTickets();
     }, [filterStatus]);

     const handleSendReply = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!selectedTicket || !replyMessage.trim()) return;

          try {
               await crmService.replyTicket(selectedTicket.id, replyMessage, false);
               setReplyMessage('');
               await loadTicketDetail(selectedTicket.id);
               await loadTickets();
          } catch (err) {
               console.error("Yanıt gönderilemedi", err);
          }
     };

     const handleStatusChange = async (newStatus: string) => {
          if (!selectedTicket) return;
          try {
               const updated = await crmService.updateTicketStatus(selectedTicket.id, newStatus);
               setSelectedTicket(updated);
               await loadTickets();
          } catch (err) {
               console.error("Durum güncellenemedi", err);
          }
     };

     const getStatusBadgeVariant = (status: string) => {
          switch (status) {
               case 'OPEN': return 'info';
               case 'IN_PROGRESS': return 'warning';
               case 'RESOLVED': return 'success';
               case 'CLOSED': return 'default';
               default: return 'default';
          }
     };

     const getStatusLabel = (status: string) => {
          switch (status) {
               case 'OPEN': return 'Açık';
               case 'IN_PROGRESS': return 'İşlemde';
               case 'RESOLVED': return 'Çözümlendi';
               case 'CLOSED': return 'Kapatıldı';
               default: return status;
          }
     };

     const getPriorityBadge = (prio: string) => {
          switch (prio) {
               case 'LOW': return <span className="text-xs text-[var(--text-muted)]">Düşük</span>;
               case 'NORMAL': return <span className="text-xs text-blue-400 font-medium">Normal</span>;
               case 'HIGH': return <span className="text-xs text-orange-400 font-bold">Yüksek</span>;
               case 'URGENT': return <span className="text-xs text-red-500 font-bold">Acil</span>;
               default: return null;
          }
     };

     return (
          <div className="electric-page">
               <div className="app-page-container flex flex-col h-full h-[calc(100vh-20px)]">
                    <div className="flex justify-between items-center mb-5 shrink-0 px-2">
                         <div>
                              <h1 className="text-2xl font-bold text-[var(--text-main)] m-0 flex items-center gap-3">
                                   <MessageSquare className="text-[var(--primary)]" size={28} />
                                   Müşteri Talepleri (Destek)
                              </h1>
                              <p className="text-[var(--text-muted)] text-sm mt-1 mb-0">Özel müşterilerinizden gelen destek biletleri ve yazışmaları</p>
                         </div>
                         <div className="flex items-center gap-3">
                              <Button variant="secondary" onClick={loadTickets}>
                                   <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                                   Yenile
                              </Button>
                              <select
                                   value={filterStatus}
                                   onChange={e => setFilterStatus(e.target.value)}
                                   className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-main)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                              >
                                   <option value="">Tümü</option>
                                   <option value="OPEN">Yeni Gelenler (Açık)</option>
                                   <option value="IN_PROGRESS">İşlemde Olanlar</option>
                                   <option value="RESOLVED">Çözülenler</option>
                              </select>
                         </div>
                    </div>

                    <div className="flex gap-5 flex-1 min-h-0">
                         {/* Sol - Liste */}
                         <Card className="w-1/3 flex flex-col p-0 overflow-hidden border border-[var(--border)] bg-[var(--bg-card)]">
                              <div className="p-4 border-b border-[var(--border)] bg-[rgba(255,255,255,0.02)] shrink-0">
                                   <h3 className="font-semibold text-[var(--text-main)] m-0">Gelen Kayıtlar</h3>
                              </div>
                              <div className="flex-1 overflow-y-auto w-full p-2 space-y-2">
                                   {loading && tickets.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-12 text-[var(--text-muted)] h-full">
                                             <RefreshCw className="w-8 h-8 animate-spin mb-4 opacity-50 text-[var(--primary)]" />
                                             <p>Biletler yükleniyor...</p>
                                        </div>
                                   ) : tickets.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center p-12 text-[var(--text-muted)] h-full">
                                             <CheckCircle2 className="w-12 h-12 text-[var(--success)] mb-3 opacity-80" />
                                             <p className="text-sm font-medium text-center">Tüm kayıtlar temiz!<br />Bekleyen destek talebi yok.</p>
                                        </div>
                                   ) : (
                                        <ul className="m-0 p-0 list-none space-y-1">
                                             {tickets.map(t => {
                                                  const isSelected = selectedTicket?.id === t.id;
                                                  return (
                                                       <li
                                                            key={t.id}
                                                            onClick={() => loadTicketDetail(t.id)}
                                                            className={`p-4 rounded-xl cursor-pointer transition-all border ${isSelected ? 'border-[var(--primary)] bg-[rgba(var(--primary-rgb),0.08)]' : 'border-transparent bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.06)]'}`}
                                                       >
                                                            <div className="flex justify-between items-start mb-2">
                                                                 <h4 className={`text-sm font-semibold m-0 line-clamp-1 pr-2 ${isSelected ? 'text-[var(--primary)]' : 'text-[var(--text-main)]'}`}>{t.subject}</h4>
                                                                 <Badge variant={getStatusBadgeVariant(t.status) as any}>{getStatusLabel(t.status)}</Badge>
                                                            </div>
                                                            <div className="text-xs text-[var(--text-muted)] mb-3">{t.accountName || 'Bilinmiyor'}</div>
                                                            <div className="flex justify-between items-center text-xs mt-auto pt-2 border-t border-[var(--border)] border-opacity-50">
                                                                 <span className="flex items-center text-[var(--text-dim)]">
                                                                      <Clock className="w-3.5 h-3.5 mr-1" />
                                                                      {new Date(t.updatedAt).toLocaleDateString('tr-TR')}
                                                                 </span>
                                                                 {getPriorityBadge(t.priority)}
                                                            </div>
                                                       </li>
                                                  )
                                             })}
                                        </ul>
                                   )}
                              </div>
                         </Card>

                         {/* Sağ - Detay & Mesajlaşma */}
                         <Card className="w-2/3 flex flex-col p-0 overflow-hidden relative border border-[var(--border)] bg-[var(--bg-card)]">
                              {selectedTicket ? (
                                   <div className="flex flex-col h-full w-full">
                                        {/* Header */}
                                        <div className="p-5 border-b border-[var(--border)] bg-[rgba(255,255,255,0.02)] flex justify-between items-start shrink-0 backdrop-blur-md">
                                             <div>
                                                  <h2 className="text-xl font-bold text-[var(--text-main)] m-0 mb-1.5 flex items-center gap-2">
                                                       {selectedTicket.subject}
                                                  </h2>
                                                  <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                                                       <span className="font-medium text-[var(--text-main)]">{selectedTicket.accountName}</span>
                                                       <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
                                                       <span>Özel Müşteri</span>
                                                  </div>
                                             </div>
                                             <div className="flex gap-2">
                                                  <select
                                                       value={selectedTicket.status}
                                                       onChange={e => handleStatusChange(e.target.value)}
                                                       className="text-sm border border-[var(--primary)] text-[var(--primary)] rounded-lg px-3 py-1.5 bg-[rgba(var(--primary-rgb),0.1)] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)] transition-all cursor-pointer"
                                                  >
                                                       <option value="OPEN" className="bg-[var(--bg-card)] text-[var(--text-main)]">Açık (Yeni)</option>
                                                       <option value="IN_PROGRESS" className="bg-[var(--bg-card)] text-[var(--text-main)]">İşleme Al</option>
                                                       <option value="RESOLVED" className="bg-[var(--bg-card)] text-[var(--text-main)]">Çözüldü Olarak İşaretle</option>
                                                       <option value="CLOSED" className="bg-[var(--bg-card)] text-[var(--text-main)]">Kapat</option>
                                                  </select>
                                             </div>
                                        </div>

                                        {/* Main Desc & MSGs */}
                                        <div className="flex-1 overflow-y-auto p-6 bg-[rgba(0,0,0,0.2)] flex flex-col gap-6 custom-scrollbar">
                                             {/* Ilk aciklama */}
                                             <div className="bg-[var(--bg-elevated)] p-5 rounded-xl border border-[var(--border)] shadow-lg w-full relative overflow-hidden">
                                                  <div className="absolute top-0 left-0 w-1 h-full bg-[var(--text-muted)] opacity-50" />
                                                  <div className="text-xs font-semibold text-[var(--text-muted)] mb-3 pb-3 border-b border-[var(--border)] flex justify-between items-center px-2">
                                                       <span className="flex items-center gap-1.5"><MessageSquare size={14} /> İlk Talep (Açıklama)</span>
                                                       <span className="flex items-center gap-1.5"><Clock size={14} /> {new Date(selectedTicket.createdAt).toLocaleString('tr-TR')}</span>
                                                  </div>
                                                  <p className="text-[15px] text-[var(--text-main)] whitespace-pre-wrap m-0 px-2 leading-relaxed">{selectedTicket.description}</p>
                                             </div>

                                             {/* Messages */}
                                             <div className="flex flex-col gap-4 mt-2">
                                                  {selectedTicket.messages?.map(msg => {
                                                       const isMyReply = String(msg.senderId) === String(user?.id); // backend token id
                                                       const isOperator = msg.senderName && msg.senderName !== selectedTicket.accountName;

                                                       return (
                                                            <div key={msg.id} className={`flex ${isMyReply || isOperator ? 'justify-end' : 'justify-start'}`}>
                                                                 <div className={`max-w-[85%] p-4 rounded-2xl shadow-md ${isMyReply || isOperator ? 'bg-[var(--primary)] text-white rounded-br-sm' : 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-main)] rounded-bl-sm'}`}>
                                                                      <div className={`text-xs font-bold mb-2 flex justify-between gap-6 items-center border-b border-white/10 pb-2 ${isMyReply || isOperator ? 'text-white/80' : 'text-[var(--text-muted)]'}`}>
                                                                           <span className="flex items-center gap-1.5">
                                                                                {msg.senderName || 'Bilinmiyor'}
                                                                                {(isMyReply || isOperator) && (
                                                                                     <span className="scale-75 origin-left tracking-wide uppercase px-1.5 py-0 border-none bg-black/20 text-white rounded">
                                                                                          <Badge variant="success">YETKİLİ</Badge>
                                                                                     </span>
                                                                                )}
                                                                           </span>
                                                                           <span className="font-mono text-[10px] opacity-70">{new Date(msg.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                      </div>
                                                                      <p className="m-0 text-[14px] whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                                                 </div>
                                                            </div>
                                                       )
                                                  })}
                                             </div>
                                        </div>

                                        {/* Reply */}
                                        <div className="p-5 border-t border-[var(--border)] bg-[var(--bg-card)] shrink-0">
                                             <form onSubmit={handleSendReply} className="flex gap-3 items-end relative">
                                                  <textarea
                                                       rows={2}
                                                       className="flex-1 border border-[var(--border)] rounded-xl p-4 text-[15px] focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] resize-none bg-[var(--bg-main)] text-[var(--text-main)] placeholder-[var(--text-dim)] transition-all custom-scrollbar"
                                                       placeholder="Müşteriye yanıt yazın... (Göndermek için Enter)"
                                                       value={replyMessage}
                                                       onChange={e => setReplyMessage(e.target.value)}
                                                       onKeyDown={e => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                 e.preventDefault();
                                                                 handleSendReply(e);
                                                            }
                                                       }}
                                                  />
                                                  <button
                                                       type="submit"
                                                       disabled={!replyMessage.trim()}
                                                       className="h-[58px] min-w-[58px] rounded-xl flex items-center justify-center p-0 transition-transform active:scale-95 shadow-md shadow-[var(--primary-glow)] disabled:opacity-50 disabled:shadow-none bg-[var(--primary)] text-white hover:brightness-110"
                                                  >
                                                       <Send className="w-5 h-5 -ml-0.5" />
                                                  </button>
                                             </form>
                                        </div>
                                   </div>
                              ) : (
                                   <div className="flex flex-col h-full items-center justify-center text-[var(--text-dim)] bg-[rgba(0,0,0,0.1)]">
                                        <div className="w-24 h-24 mb-6 rounded-full bg-[rgba(255,255,255,0.03)] flex items-center justify-center border border-[var(--border)]">
                                             <MessageSquare className="w-10 h-10 text-[var(--text-muted)] opacity-50" />
                                        </div>
                                        <p className="text-lg font-medium text-[var(--text-muted)]">Destek Talebi Seçin</p>
                                        <p className="text-sm mt-2 opacity-70">Detayları ve yazışmaları görmek için listeden bir kayıt seçin.</p>
                                   </div>
                              )}
                         </Card>
                    </div>
               </div>
          </div>
     );
}
