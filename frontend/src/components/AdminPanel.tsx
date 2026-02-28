import React, { useState, useEffect } from 'react';
import { ClipboardList, Users, Factory, MessageSquare, BarChart3, CheckCircle2, Clock, TrendingUp, DollarSign } from 'lucide-react';

interface Order {
  id: number;
  customer_name: string;
  status: string;
  created_at: string;
  ts_code: string;
  material_name: string;
  thickness_mm: number;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  created_at: string;
}

interface Station {
  id: number;
  name: string;
  description: string;
}

interface Message {
  id: number;
  customer_name: string;
  template_name: string;
  status: string;
  created_at: string;
}

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orders' | 'customers' | 'stations' | 'whatsapp' | 'reports'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  // Verileri yükle
  useEffect(() => {
    loadOrders();
    loadCustomers();
    loadStations();
    loadMessages();
  }, []);

  const loadOrders = async () => {
    try {
      const response = await fetch('/api/v1/orders');
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Siparişler yüklenemedi:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/v1/customers');
      if (response.ok) {
        const data = await response.json();
        setCustomers(data || []);
      }
    } catch (error) {
      console.error('Müşteriler yüklenemedi:', error);
    }
  };

  const loadStations = async () => {
    try {
      const response = await fetch('/api/v1/stations');
      if (response.ok) {
        const data = await response.json();
        setStations(data || []);
      }
    } catch (error) {
      console.error('İstasyonlar yüklenemedi:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await fetch('/api/v1/whatsapp/messages');
      if (response.ok) {
        const data = await response.json();
        setMessages(data || []);
      }
    } catch (error) {
      console.error('Mesajlar yüklenemedi:', error);
    }
  };

  // Edit handlers
  const [, setEditingOrder] = useState<Order | null>(null);
  const [, setEditingCustomer] = useState<Customer | null>(null);
  const [, setEditingStation] = useState<Station | null>(null);
  const [, setShowNewCustomerForm] = useState(false);
  const [, setShowNewStationForm] = useState(false);
  const [, setShowOrderDetail] = useState<Order | null>(null);

  const handleDeleteOrder = async (id: number) => {
    if (!confirm('Bu siparisi silmek istediginize emin misiniz?')) return;
    try {
      const response = await fetch(`/api/v1/orders/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setOrders(prev => prev.filter(o => o.id !== id));
        alert('Siparis silindi');
      }
    } catch (error) {
      console.error('Silme hatasi:', error);
    }
  };

  const handleDeleteCustomer = async (id: number) => {
    if (!confirm('Bu musteriyi silmek istediginize emin misiniz?')) return;
    try {
      const response = await fetch(`/api/v1/customers/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setCustomers(prev => prev.filter(c => c.id !== id));
        alert('Musteri silindi');
      }
    } catch (error) {
      console.error('Silme hatasi:', error);
    }
  };

  const handleDeleteStation = async (id: number) => {
    if (!confirm('Bu istasyonu silmek istediginize emin misiniz?')) return;
    try {
      const response = await fetch(`/api/v1/stations/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setStations(prev => prev.filter(s => s.id !== id));
        alert('Istasyon silindi');
      }
    } catch (error) {
      console.error('Silme hatasi:', error);
    }
  };

  const handleResendMessage = async (message: Message) => {
    try {
      const response = await fetch(`/api/v1/whatsapp/messages/${message.id}/resend`, { method: 'POST' });
      if (response.ok) {
        alert('Mesaj yeniden gonderildi');
        loadMessages();
      }
    } catch (error) {
      console.error('Yeniden gonderme hatasi:', error);
    }
  };

  const handleDeleteMessage = async (id: number) => {
    if (!confirm('Bu mesaji silmek istediginize emin misiniz?')) return;
    try {
      const response = await fetch(`/api/v1/whatsapp/messages/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setMessages(prev => prev.filter(m => m.id !== id));
      }
    } catch (error) {
      console.error('Silme hatasi:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'DRAFT': 'bg-gray-100 text-gray-800',
      'PENDING_APPROVAL': 'bg-yellow-100 text-yellow-800',
      'HOLD': 'bg-orange-100 text-orange-800',
      'IN_PRODUCTION': 'bg-blue-100 text-blue-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'DELIVERED': 'bg-purple-100 text-purple-800',
      'CANCELLED': 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status: string) => {
    const texts: Record<string, string> = {
      'DRAFT': 'Taslak',
      'PENDING_APPROVAL': 'Onay Bekliyor',
      'HOLD': 'Bekletilen',
      'IN_PRODUCTION': 'Üretimde',
      'COMPLETED': 'Hazır',
      'DELIVERED': 'Teslim Edildi',
      'CANCELLED': 'İptal'
    };
    return texts[status] || status;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gray-900 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">OPTIPLAN360 Yönetim Paneli</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">Yönetici</span>
              <button 
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm"
                onClick={() => window.location.href = '/logout'}
              >
                Çıkış
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-gray-900 border-b">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            {[
              { id: 'orders' as const, label: 'Siparişler', icon: <ClipboardList size={16} aria-hidden="true" /> },
              { id: 'customers' as const, label: 'Müşteriler', icon: <Users size={16} aria-hidden="true" /> },
              { id: 'stations' as const, label: 'İstasyonlar', icon: <Factory size={16} aria-hidden="true" /> },
              { id: 'whatsapp' as const, label: 'WhatsApp', icon: <MessageSquare size={16} aria-hidden="true" /> },
              { id: 'reports' as const, label: 'Raporlar', icon: <BarChart3 size={16} aria-hidden="true" /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Siparişler Tab */}
        {activeTab === 'orders' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Sipariş Yönetimi</h2>
              <div className="flex space-x-4">
                <select className="border rounded px-3 py-2 text-sm">
                  <option value="">Tüm Durumlar</option>
                  <option value="DRAFT">Taslak</option>
                  <option value="PENDING_APPROVAL">Onay Bekliyor</option>
                  <option value="IN_PRODUCTION">Üretimde</option>
                  <option value="COMPLETED">Hazır</option>
                  <option value="DELIVERED">Teslim Edildi</option>
                </select>
                <input
                  type="text"
                  placeholder="Sipariş ara..."
                  className="border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="bg-gray-900 shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sipariş No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Müşteri
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Malzeme
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kalınlık
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tarih
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-900 divide-y divide-gray-200">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.ts_code}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.customer_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.material_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.thickness_mm}mm
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          className="text-blue-600 hover:text-blue-900 mr-3" 
                          onClick={() => setShowOrderDetail(order)}
                        >
                          Detay
                        </button>
                        <button 
                          className="text-green-600 hover:text-green-900 mr-3" 
                          onClick={() => setEditingOrder(order)}
                        >
                          Düzenle
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-900" 
                          onClick={() => handleDeleteOrder(order.id)}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Müşteriler Tab */}
        {activeTab === 'customers' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Müşteri Yönetimi</h2>
              <button 
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                onClick={() => setShowNewCustomerForm(true)}
              >
                + Yeni Müşteri
              </button>
            </div>

            <div className="bg-gray-900 shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ad Soyad
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Telefon
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Kayıt Tarihi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-900 divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {customer.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(customer.created_at).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          onClick={() => setEditingCustomer(customer)}
                        >
                          Düzenle
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-900"
                          onClick={() => handleDeleteCustomer(customer.id)}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* İstasyonlar Tab */}
        {activeTab === 'stations' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">İstasyon Yönetimi</h2>
              <button 
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                onClick={() => setShowNewStationForm(true)}
              >
                + Yeni İstasyon
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stations.map((station) => (
                <div key={station.id} className="bg-gray-900 p-6 rounded-lg shadow">
                  <div className="flex items-center mb-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-semibold">{station.name.charAt(0)}</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-medium text-gray-900">{station.name}</h3>
                      <p className="text-sm text-gray-500">İstasyon #{station.id}</p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4">{station.description}</p>
                  <div className="flex justify-end space-x-2">
                    <button 
                      className="text-blue-600 hover:text-blue-900 text-sm"
                      onClick={() => setEditingStation(station)}
                    >
                      Düzenle
                    </button>
                    <button 
                      className="text-red-600 hover:text-red-900 text-sm"
                      onClick={() => handleDeleteStation(station.id)}
                    >
                      Sil
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WhatsApp Tab */}
        {activeTab === 'whatsapp' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">WhatsApp Mesaj Yönetimi</h2>
              <div className="flex space-x-4">
                <button 
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm"
                  onClick={() => alert('Test mesaji gonderiliyor...')}
                >
                  Test Mesaji Gonder
                </button>
                <button 
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                  onClick={() => alert('Ayarlar aciliyor...')}
                >
                  Ayarlar
                </button>
              </div>
            </div>

            <div className="bg-gray-900 shadow rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Müşteri
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Şablon
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Durum
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tarih
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      İşlemler
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-900 divide-y divide-gray-200">
                  {messages.map((message) => (
                    <tr key={message.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {message.customer_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {message.template_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          message.status === 'SENT' ? 'bg-green-100 text-green-800' :
                          message.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {message.status === 'SENT' ? 'Gönderildi' :
                           message.status === 'FAILED' ? 'Başarısız' : 'Bekliyor'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(message.created_at).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          className="text-blue-600 hover:text-blue-900 mr-3"
                          onClick={() => handleResendMessage(message)}
                        >
                          Yeniden Gonder
                        </button>
                        <button 
                          className="text-red-600 hover:text-red-900"
                          onClick={() => handleDeleteMessage(message.id)}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Raporlar Tab */}
        {activeTab === 'reports' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Raporlar ve Analiz</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-900 p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <ClipboardList size={18} className="text-blue-600" aria-hidden="true" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Toplam Sipariş</p>
                    <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-900 p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={18} className="text-green-600" aria-hidden="true" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Tamamlanan</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {orders.filter(o => o.status === 'DELIVERED').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-900 p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Clock size={18} className="text-yellow-600" aria-hidden="true" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Üretimde</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {orders.filter(o => o.status === 'IN_PRODUCTION').length}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-900 p-6 rounded-lg shadow">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Users size={18} className="text-purple-600" aria-hidden="true" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Müşteri</p>
                    <p className="text-2xl font-bold text-gray-900">{customers.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Hızlı Raporlar</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button 
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                  onClick={() => alert('Siparis durum raporu olusturuluyor...')}
                >
                  <BarChart3 size={16} aria-hidden="true" style={{display:'inline',marginRight:4}} /> Siparis Durum Raporu
                </button>
                <button 
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
                  onClick={() => alert('Uretim analizi olusturuluyor...')}
                >
                  <TrendingUp size={16} aria-hidden="true" style={{display:'inline',marginRight:4}} /> Uretim Analizi
                </button>
                <button 
                  className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded"
                  onClick={() => alert('Musteri analizi olusturuluyor...')}
                >
                  <DollarSign size={16} aria-hidden="true" style={{display:'inline',marginRight:4}} /> Musteri Analizi
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;
