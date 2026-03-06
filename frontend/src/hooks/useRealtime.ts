import { useEffect, useRef } from 'react';


import { getApiBaseUrl } from '../services/apiClient';





export interface WebSocketEvent {


     type: string;


     data: unknown;


}





export function useRealtime(onEvent: (event: WebSocketEvent) => void) {


     const ws = useRef<WebSocket | null>(null);





     useEffect(() => {


          const rawBaseUrl = getApiBaseUrl();


          // http://localhost:8080/api/v1 -> ws://localhost:8080/ws



          // Basit bir regex ile base domain'i alıp /ws endpoint'ine bağlıyoruz.


          const wsUrl = rawBaseUrl


               .replace(/^http/, 'ws')


               .replace(/\/api\/v1\/?$/, '/ws'); // API prefixini sil





          // Bağlantı nesnesi


          const socket = new WebSocket(wsUrl);


          ws.current = socket;





          socket.onopen = () => {


               console.log('[Realtime] Connected to live updates.');


          };





          socket.onmessage = (event) => {


               try {


                    const payload: WebSocketEvent = JSON.parse(event.data);


                    if (payload && payload.type) {


                    console.log(`[Realtime] Event Received: ${payload.type}`, payload.data);


                         onEvent(payload);


                    }


               } catch (err) {


                    console.error('Error parsing WS message', err);


               }


          };





          socket.onclose = () => {


               console.log('[Realtime] Disconnected. Reconnection handles can be added here.');


          };





          // Temizleme (Cleanup)


          return () => {


               socket.close();


          };


     }, [onEvent]);


}


