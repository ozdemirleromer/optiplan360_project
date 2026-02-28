import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, Play, Eye, Download, FileJson, RefreshCw, BarChart2 } from 'lucide-react';
import NestingVisualizer from '../../components/Optimization/NestingVisualizer';
import { NestingData } from '../../types';

const OptimizationWorkbench: React.FC = () => {
     const { orderId } = useParams<{ orderId: string }>();
     const [nestingData, setNestingData] = useState<NestingData | null>(null);
     const [loading, setLoading] = useState(false);
     const [activeTab, setActiveTab] = useState<'visualizer' | 'params'>('visualizer');

     // Load preview data
     const loadPreview = async () => {
          setLoading(true);
          try {
               // API call placeholder - backend router'daki /preview/{order_id} endpoint'ini kullanır
               const response = await fetch(`/api/v1/optiplanning/preview/${orderId || 'last'}`);
               const data = await response.json();
               setNestingData(data);
          } catch (error) {
               console.error('Nesting onizleme yukleme hatasi:', error);
          } finally {
               setLoading(false);
          }
     };

     useEffect(() => {
          loadPreview();
     }, [orderId]);

     return (
          <div className="min-h-screen bg-slate-950 text-slate-200">
               {/* Header */}
               <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10 px-6 py-4">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                         <div className="flex items-center gap-4">
                              <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
                                   <BarChart2 className="w-6 h-6 text-blue-400" />
                              </div>
                              <div>
                                   <h1 className="text-2xl font-bold text-white tracking-tight">OptiPlanning Workbench</h1>
                                   <p className="text-slate-400 text-sm">Sipariş: <span className="text-blue-400 font-mono">#{orderId || 'Tüm Liste'}</span></p>
                              </div>
                         </div>

                         <div className="flex items-center gap-3">
                              <button
                                   onClick={loadPreview}
                                   className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center gap-2 border border-slate-700 transition-all active:scale-95"
                              >
                                   <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                   Yenile
                              </button>
                              <button className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-blue-900/20 transition-all active:scale-95">
                                   <Play className="w-4 h-4" />
                                   Optimizasyonu Başlat
                              </button>
                         </div>
                    </div>
               </div>

               <div className="max-w-7xl mx-auto p-6 grid grid-cols-12 gap-6">
                    {/* Sidebar / Parameters */}
                    <div className="col-span-12 lg:col-span-3 space-y-6">
                         <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 shadow-xl">
                              <div className="flex items-center gap-2 mb-6 text-white font-semibold">
                                   <Settings className="w-5 h-5 text-blue-400" />
                                   <span>Optimizasyon Ayarları</span>
                              </div>

                              <div className="space-y-4">
                                   <div>
                                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Algoritma Modu</label>
                                        <select className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all">
                                             <option>Minimum Fire (Mod A)</option>
                                             <option>Maksimum Hız (Mod B)</option>
                                             <option>Dengeli (Mod C)</option>
                                        </select>
                                   </div>

                                   <div>
                                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Kenar Payı (Trim)</label>
                                        <div className="flex items-center gap-2 mt-1">
                                             <input type="number" defaultValue={10} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                                             <span className="text-xs text-slate-600">mm</span>
                                        </div>
                                   </div>

                                   <div>
                                        <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Plaka Çapraz Kontrolü</label>
                                        <div className="mt-2">
                                             <label className="relative inline-flex items-center cursor-pointer">
                                                  <input type="checkbox" className="sr-only peer" defaultChecked />
                                                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                             </label>
                                        </div>
                                   </div>
                              </div>

                              <div className="mt-8 pt-6 border-t border-slate-800">
                                   <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                        <span>Plaka Kullanımı</span>
                                        <span className="text-blue-400 font-bold">84%</span>
                                   </div>
                                   <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 h-full" style={{ width: '84%' }}></div>
                                   </div>
                              </div>
                         </div>
                    </div>

                    {/* Main Workspace */}
                    <div className="col-span-12 lg:col-span-9">
                         <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl min-h-[600px]">
                              {/* Tabs */}
                              <div className="flex border-b border-slate-800">
                                   <button
                                        onClick={() => setActiveTab('visualizer')}
                                        className={`px-6 py-4 text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'visualizer' ? 'bg-slate-800/50 text-blue-400 border-b-2 border-blue-500' : 'text-slate-400 hover:text-white hover:bg-slate-800/30'}`}
                                   >
                                        <Eye className="w-4 h-4" />
                                        Kesim Şeması Gözlemcisi
                                   </button>
                                   <button
                                        onClick={() => setActiveTab('params')}
                                        className={`px-6 py-4 text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'params' ? 'bg-slate-800/50 text-blue-400 border-b-2 border-blue-500' : 'text-slate-400 hover:text-white hover:bg-slate-800/30'}`}
                                   >
                                        <FileJson className="w-4 h-4" />
                                        Ham Veri (JSON)
                                   </button>

                                   <div className="ml-auto flex items-center gap-2 px-4">
                                        <button className="p-2 text-slate-400 hover:text-white transition-colors" title="PDF Dışa Aktar">
                                             <Download className="w-5 h-5" />
                                        </button>
                                   </div>
                              </div>

                              <div className="p-4">
                                   {loading ? (
                                        <div className="flex flex-col items-center justify-center h-[500px] gap-4">
                                             <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
                                             <p className="text-slate-400 animate-pulse">OptiPlanning verileri okunuyor...</p>
                                        </div>
                                   ) : activeTab === 'visualizer' ? (
                                        nestingData ? (
                                             <NestingVisualizer data={nestingData} scale={0.3} />
                                        ) : (
                                             <div className="flex flex-col items-center justify-center h-[500px] text-slate-500">
                                                  <Eye className="w-12 h-12 mb-4 opacity-20" />
                                                  <p>Önizleme yüklenemedi. Lütfen optimizasyonu başlatın.</p>
                                             </div>
                                        )
                                   ) : (
                                        <pre className="bg-slate-950 p-6 rounded-xl font-mono text-xs text-blue-300 overflow-auto max-h-[500px] border border-slate-800">
                                             {JSON.stringify(nestingData, null, 2)}
                                        </pre>
                                   )}
                              </div>
                         </div>
                    </div>
               </div>
          </div>
     );
};

export default OptimizationWorkbench;
