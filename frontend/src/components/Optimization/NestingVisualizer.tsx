import React from 'react';
import { NestingData } from '../../types';

interface NestingVisualizerProps {
     data: NestingData;
     scale?: number;
}

const NestingVisualizer: React.FC<NestingVisualizerProps> = ({ data, scale = 0.2 }) => {
     if (!data || !data.sheets || data.sheets.length === 0) {
          return (
               <div className="flex items-center justify-center h-64 bg-slate-900/50 rounded-xl border border-slate-800 text-slate-400">
                    Görselleştirilecek veri bulunamadı.
               </div>
          );
     }

     return (
          <div className="space-y-8 p-4">
               {data.sheets.map((sheet, index) => (
                    <div key={sheet.id || index} className="space-y-4">
                         <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold text-white">Plaka #{sheet.id}</h3>
                              <span className="text-sm text-slate-400">{sheet.width} x {sheet.height} mm</span>
                         </div>

                         <div className="relative overflow-auto bg-slate-950 rounded-xl p-4 border border-slate-800 shadow-2xl">
                              <svg
                                   width={sheet.width * scale}
                                   height={sheet.height * scale}
                                   viewBox={`0 0 ${sheet.width} ${sheet.height}`}
                                   className="mx-auto drop-shadow-lg"
                              >
                                   {/* Main Sheet */}
                                   <rect
                                        x={0}
                                        y={0}
                                        width={sheet.width}
                                        height={sheet.height}
                                        fill="#1e293b"
                                        stroke="#334155"
                                        strokeWidth={2}
                                   />

                                   {/* Parts */}
                                   {sheet.parts.map((part, pIdx) => (
                                        <g key={part.id || pIdx} className="transition-opacity hover:opacity-80 cursor-help">
                                             <rect
                                                  x={part.x}
                                                  y={part.y}
                                                  width={part.width}
                                                  height={part.height}
                                                  fill={part.is_waste ? '#4b5563' : '#3b82f6'}
                                                  stroke="#ffffff33"
                                                  strokeWidth={1}
                                                  className="transition-all duration-300"
                                             />
                                             {!part.is_waste && part.width > 100 && part.height > 50 && (
                                                  <text
                                                       x={part.x + part.width / 2}
                                                       y={part.y + part.height / 2}
                                                       textAnchor="middle"
                                                       dominantBaseline="middle"
                                                       fill="white"
                                                       fontSize={40}
                                                       fontWeight="600"
                                                       className="select-none pointer-events-none"
                                                  >
                                                       {part.id}
                                                  </text>
                                             )}
                                             <title>{`${part.desc || (part.is_waste ? 'Fire' : 'Parça')}: ${part.width}x${part.height}`}</title>
                                        </g>
                                   ))}
                              </svg>
                         </div>
                    </div>
               ))}
          </div>
     );
};

export default NestingVisualizer;
