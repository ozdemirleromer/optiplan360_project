"""
OptiPlan 360 - WebSocket Manager
Real-time sipariş ve istasyon güncellemeleri
"""

from datetime import datetime
from typing import Dict, Set

from fastapi import WebSocket


class ConnectionManager:
    """WebSocket bağlantı yöneticisi"""

    def __init__(self):
        # Aktif bağlantılar: {user_id: WebSocket}
        self.active_connections: Dict[str, WebSocket] = {}
        # Kanal abonelikleri: {channel: Set[user_id]}
        self.channels: Dict[str, Set[str]] = {
            "orders": set(),
            "stations": set(),
            "notifications": set(),
        }

    async def connect(self, websocket: WebSocket, user_id: str):
        """Yeni bağlantı kabul et"""
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: str):
        """Bağlantıyı kapat"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        # Tüm kanallardan çıkar
        for channel in self.channels.values():
            channel.discard(user_id)

    def subscribe(self, user_id: str, channel: str):
        """Kanala abone ol"""
        if channel in self.channels:
            self.channels[channel].add(user_id)

    def unsubscribe(self, user_id: str, channel: str):
        """Kanal aboneliğini iptal et"""
        if channel in self.channels:
            self.channels[channel].discard(user_id)

    async def send_to_user(self, user_id: str, message: dict):
        """Belirli kullanıcıya mesaj gönder"""
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_json(message)

    async def broadcast_to_channel(self, channel: str, message: dict):
        """Kanaldaki tüm kullanıcılara mesaj gönder"""
        if channel in self.channels:
            disconnected = []
            for user_id in self.channels[channel]:
                if user_id in self.active_connections:
                    try:
                        await self.active_connections[user_id].send_json(message)
                    except Exception:
                        disconnected.append(user_id)
                else:
                    disconnected.append(user_id)

            # Temizlik
            for user_id in disconnected:
                self.channels[channel].discard(user_id)

    async def broadcast(self, message: dict):
        """Tüm bağlı kullanıcılara mesaj gönder"""
        disconnected = []
        for user_id, websocket in self.active_connections.items():
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(user_id)

        # Temizlik
        for user_id in disconnected:
            self.disconnect(user_id)


# Singleton instance
manager = ConnectionManager()


# WebSocket message builders
def build_order_update_message(order_id: str, status: str, updated_by: str = None) -> dict:
    """Sipariş güncelleme mesajı oluştur"""
    return {
        "type": "order_update",
        "data": {
            "order_id": order_id,
            "status": status,
            "updated_by": updated_by,
            "timestamp": datetime.now().isoformat(),
        },
    }


def build_station_scan_message(station_id: str, order_id: str, scan_type: str) -> dict:
    """İstasyon tarama mesajı oluştur"""
    return {
        "type": "station_scan",
        "data": {
            "station_id": station_id,
            "order_id": order_id,
            "scan_type": scan_type,
            "timestamp": datetime.now().isoformat(),
        },
    }


def build_notification_message(title: str, message: str, priority: str = "normal") -> dict:
    """Bildirim mesajı oluştur"""
    return {
        "type": "notification",
        "data": {
            "title": title,
            "message": message,
            "priority": priority,
            "timestamp": datetime.now().isoformat(),
        },
    }


# Broadcast helper functions
async def notify_order_update(order_id: str, status: str, updated_by: str = None):
    """Sipariş güncellemesini bildir"""
    message = build_order_update_message(order_id, status, updated_by)
    await manager.broadcast_to_channel("orders", message)


async def notify_station_scan(station_id: str, order_id: str, scan_type: str):
    """İstasyon taramasını bildir"""
    message = build_station_scan_message(station_id, order_id, scan_type)
    await manager.broadcast_to_channel("stations", message)


async def notify_user(user_id: str, title: str, message: str, priority: str = "normal"):
    """Kullanıcıya bildirim gönder"""
    notification = build_notification_message(title, message, priority)
    await manager.send_to_user(user_id, notification)
