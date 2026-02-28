import json
import logging
from typing import List

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        # Aktif bağlantıları tutar (tüm admin ve operatör ekranları)
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total clients: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket disconnected. Total clients: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """
        Gelen payload'u tüm bağlı ekranlara (React) saniyesinde basar.
        """
        if not self.active_connections:
            return

        json_message = json.dumps(message)
        dead_connections = []

        for connection in self.active_connections:
            try:
                await connection.send_text(json_message)
            except Exception as e:
                logger.warning(f"Error sending message to websocket client: {e}")
                dead_connections.append(connection)

        # Kopan bağlantıları temizle
        for dead in dead_connections:
            self.disconnect(dead)


# Tüm uygulama içinde kullanılacak tekil örnek (Singleton)
manager = ConnectionManager()
