"""
AI Asistan Servisi - Gemini entegrasyonlu iş akışları
OptiPlan 360 için özel AI asistan fonksiyonları
"""

import json
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta, timezone
import logging

from app.services.gemini_service import get_gemini_service
from app.database import SessionLocal
from app.models import User, Order, Customer, StockCard

logger = logging.getLogger(__name__)

class AIAssistantService:
    """AI Asistan servis sınıfı - OptiPlan 360 özel iş akışları"""
    
    def __init__(self):
        self.gemini_service = get_gemini_service()
    
    async def analyze_business_data(
        self, 
        user_id: str,
        analysis_type: str = "general"
    ) -> Dict[str, Any]:
        """
        İş verilerini analiz eder
        
        Args:
            user_id: Kullanıcı ID
            analysis_type: Analiz tipi (general, orders, customers, inventory)
            
        Returns:
            Dict: Analiz sonuçları
        """
        try:
            db = SessionLocal()
            
            # Kullanıcı bilgilerini al
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return {"success": False, "error": "Kullanıcı bulunamadı"}
            
            # Verileri topla
            context_data = {}
            
            if analysis_type in ["general", "orders"]:
                # Sipariş verileri
                orders = db.query(Order).limit(100).all()
                context_data["orders"] = [
                    {
                        "id": str(o.id),
                        "status": o.status,
                        "material": o.material_name,
                        "quantity": o.quantity,
                        "created_at": o.created_at.isoformat() if o.created_at else None
                    }
                    for o in orders
                ]
            
            if analysis_type in ["general", "customers"]:
                # Müşteri verileri
                customers = db.query(Customer).limit(50).all()
                context_data["customers"] = [
                    {
                        "id": str(c.id),
                        "name": c.name,
                        "email": c.email,
                        "phone": c.phone
                    }
                    for c in customers
                ]
            
            if analysis_type in ["general", "inventory"]:
                # Stok verileri
                stocks = db.query(StockCard).limit(50).all()
                context_data["inventory"] = [
                    {
                        "id": str(s.id),
                        "stock_code": s.stock_code,
                        "stock_name": s.stock_name,
                        "total_quantity": float(s.total_quantity),
                        "available_quantity": float(s.available_quantity)
                    }
                    for s in stocks
                ]
            
            db.close()
            
            # Context'i oluştur
            context = json.dumps(context_data, ensure_ascii=False, indent=2)
            
            # Analiz prompt'u
            system_instruction = f"""
            Sen OptiPlan 360 iş analisis uzmanısın. 
            Kullanıcının {analysis_type} verilerini analiz et ve işlevsel öneriler sun.
            JSON formatında yapılandırılmış yanıt ver.
            """
            
            prompt = f"""
            Aşağıdaki OptiPlan 360 verilerini analiz et:
            
            Kullanıcı: {user.username} ({user.role})
            Analiz Tipi: {analysis_type}
            
            Veriler:
            {context}
            
            Şu analizleri yap:
            1. Genel durum özeti
            2. Eğilimler ve patternler
            3. Riskler ve fırsatlar
            4. İyileştirme önerileri
            5. Aksiyon maddeleri
            
            Yanıtı şu JSON formatında ver:
            {{
                "summary": "Genel durum özeti",
                "trends": ["Eğilim 1", "Eğilim 2"],
                "risks": ["Risk 1", "Risk 2"],
                "opportunities": ["Fırsat 1", "Fırsat 2"],
                "recommendations": ["Öneri 1", "Öneri 2"],
                "actions": ["Aksiyon 1", "Aksiyon 2"]
            }}
            """
            
            response = await self.gemini_service.generate_text_response(
                prompt=prompt,
                system_instruction=system_instruction
            )
            
            if response["success"]:
                try:
                    # JSON yanıtını parse et
                    json_text = response["response"].strip()
                    if json_text.startswith("```json"):
                        json_text = json_text.replace("```json", "").replace("```", "").strip()
                    
                    analysis_data = json.loads(json_text)
                    response["analysis"] = analysis_data
                    
                except json.JSONDecodeError:
                    response["analysis"] = {
                        "summary": response["response"],
                        "trends": [],
                        "risks": [],
                        "opportunities": [],
                        "recommendations": [],
                        "actions": []
                    }
            
            return response
            
        except Exception as e:
            logger.error(f"Business data analysis hatası: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def generate_business_report(
        self, 
        user_id: str,
        report_type: str = "weekly",
        custom_prompt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        İş raporu üretir
        
        Args:
            user_id: Kullanıcı ID
            report_type: Rapor tipi (daily, weekly, monthly, custom)
            custom_prompt: Özel rapor talimatı
            
        Returns:
            Dict: Rapor sonuçları
        """
        try:
            db = SessionLocal()
            
            # Kullanıcı bilgilerini al
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return {"success": False, "error": "Kullanıcı bulunamadı"}
            
            # Rapor tipine göre verileri filtrele
            from datetime import datetime, timedelta, timezone
            
            date_filters = {
                "daily": datetime.now(timezone.utc) - timedelta(days=1),
                "weekly": datetime.now(timezone.utc) - timedelta(days=7),
                "monthly": datetime.now(timezone.utc) - timedelta(days=30)
            }
            
            filter_date = date_filters.get(report_type, date_filters["weekly"])
            
            # Sipariş verileri
            orders = db.query(Order).filter(
                Order.created_at >= filter_date
            ).all()
            
            # Rapor verileri
            report_data = {
                "user": user.username,
                "role": user.role,
                "report_type": report_type,
                "period": {
                    "start": filter_date.isoformat(),
                    "end": datetime.now(timezone.utc).isoformat()
                },
                "orders": {
                    "total": len(orders),
                    "by_status": {},
                    "by_material": {}
                }
            }
            
            # Siparişleri analiz et
            for order in orders:
                # Duruma göre grupla
                status = order.status or "unknown"
                report_data["orders"]["by_status"][status] = report_data["orders"]["by_status"].get(status, 0) + 1
                
                # Malzemeye göre grupla
                material = order.material_name or "unknown"
                report_data["orders"]["by_material"][material] = report_data["orders"]["by_material"].get(material, 0) + 1
            
            db.close()
            
            # Rapor prompt'u
            system_instruction = """
            Sen OptiPlan 360 raporlama uzmanısın. 
            Verilen verilere göre profesyonel bir iş raporu hazırla.
            """
            
            if custom_prompt:
                prompt = custom_prompt
            else:
                prompt = f"""
                Aşağıdaki OptiPlan 360 verilerine göre {report_type} iş raporu hazırla:
                
                {json.dumps(report_data, ensure_ascii=False, indent=2)}
                
                Rapor şu bölümleri içermeli:
                1. Yönetici Özeti
                2. Performans Metrikleri
                3. Trend Analizi
                4. Sorunlar ve Çözüm Önerileri
                5. Gelecek Planları
                
                Profesyonel ve anlaşılır bir dil kullan.
                """
            
            response = await self.gemini_service.generate_text_response(
                prompt=prompt,
                system_instruction=system_instruction
            )
            
            if response["success"]:
                response["report_data"] = report_data
            
            return response
            
        except Exception as e:
            logger.error(f"Business report generation hatası: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def smart_search(
        self, 
        user_id: str,
        query: str,
        search_scope: str = "all"
    ) -> Dict[str, Any]:
        """
        Akıllı arama yapar
        
        Args:
            user_id: Kullanıcı ID
            query: Arama sorgusu
            search_scope: Arama kapsamı (orders, customers, products, all)
            
        Returns:
            Dict: Arama sonuçları
        """
        try:
            db = SessionLocal()
            
            # Kullanıcı bilgilerini al
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return {"success": False, "error": "Kullanıcı bulunamadı"}
            
            # Arama verilerini topla
            search_data = {}
            
            if search_scope in ["all", "orders"]:
                orders = db.query(Order).limit(200).all()
                search_data["orders"] = [
                    {
                        "id": str(o.id),
                        "material": o.material_name,
                        "quantity": o.quantity,
                        "status": o.status,
                        "customer_name": o.customer_name,
                        "created_at": o.created_at.isoformat() if o.created_at else None
                    }
                    for o in orders
                ]
            
            if search_scope in ["all", "customers"]:
                customers = db.query(Customer).limit(100).all()
                search_data["customers"] = [
                    {
                        "id": str(c.id),
                        "name": c.name,
                        "email": c.email,
                        "phone": c.phone,
                        "address": c.address
                    }
                    for c in customers
                ]
            
            if search_scope in ["all", "products"]:
                stocks = db.query(StockCard).limit(100).all()
                search_data["products"] = [
                    {
                        "id": str(s.id),
                        "stock_code": s.stock_code,
                        "stock_name": s.stock_name,
                        "total_quantity": float(s.total_quantity),
                        "sale_price": float(s.sale_price) if s.sale_price else None
                    }
                    for s in stocks
                ]
            
            db.close()
            
            # Arama prompt'u
            system_instruction = """
            Sen OptiPlan 360 akıllı arama uzmanısın. 
            Kullanıcının sorgusuna göre en ilgili sonuçları bul ve sırala.
            """
            
            prompt = f"""
            Kullanıcı: {user.username}
            Arama Sorgusu: {query}
            Arama Kapsamı: {search_scope}
            
            Aşağıdaki verilerde ara:
            {json.dumps(search_data, ensure_ascii=False, indent=2)}
            
            Şu formatında yanıt ver:
            {{
                "query": "Arama sorgusu",
                "total_results": 0,
                "results": [
                    {{
                        "type": "order|customer|product",
                        "id": "ID",
                        "title": "Başlık",
                        "description": "Açıklama",
                        "relevance_score": 0.95
                    }}
                ],
                "suggestions": ["Öneri 1", "Öneri 2"]
            }}
            """
            
            response = await self.gemini_service.generate_text_response(
                prompt=prompt,
                system_instruction=system_instruction
            )
            
            if response["success"]:
                try:
                    # JSON yanıtını parse et
                    json_text = response["response"].strip()
                    if json_text.startswith("```json"):
                        json_text = json_text.replace("```json", "").replace("```", "").strip()
                    
                    search_results = json.loads(json_text)
                    response["search_results"] = search_results
                    
                except json.JSONDecodeError:
                    response["search_results"] = {
                        "query": query,
                        "total_results": 0,
                        "results": [],
                        "suggestions": []
                    }
            
            return response
            
        except Exception as e:
            logger.error(f"Smart search hatası: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def get_recommendations(
        self, 
        user_id: str,
        context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Kişiselleştirilmiş öneriler üretir
        
        Args:
            user_id: Kullanıcı ID
            context: Bağlam bilgisi
            
        Returns:
            Dict: Öneriler
        """
        try:
            db = SessionLocal()
            
            # Kullanıcı bilgilerini al
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return {"success": False, "error": "Kullanıcı bulunamadı"}
            
            # Kullanıcı aktivitesini analiz et
            recent_orders = db.query(Order).filter(
                Order.created_at >= datetime.now() - timedelta(days=7)
            ).limit(20).all()
            
            # Öneri verileri
            recommendation_data = {
                "user": {
                    "username": user.username,
                    "role": user.role,
                    "last_login": user.last_login_at.isoformat() if user.last_login_at else None
                },
                "recent_activity": {
                    "order_count": len(recent_orders),
                    "common_materials": list(set([o.material_name for o in recent_orders if o.material_name])),
                    "order_statuses": list(set([o.status for o in recent_orders if o.status]))
                }
            }
            
            db.close()
            
            # Öneri prompt'u
            system_instruction = """
            Sen OptiPlan 360 kişiselleştirme uzmanısın. 
            Kullanıcının rolüne ve aktivitesine göre özel öneriler sun.
            """
            
            prompt = f"""
            Aşağıdaki kullanıcı verilerine göre kişiselleştirilmiş öneriler sun:
            
            {json.dumps(recommendation_data, ensure_ascii=False, indent=2)}
            
            Bağlam: {context or "Genel kullanım"}
            
            Şu formatında öneriler sun:
            {{
                "productivity_tips": ["İpucu 1", "İpucu 2"],
                "feature_suggestions": ["Özellik 1", "Özellik 2"],
                "workflow_improvements": ["İyileştirme 1", "İyileştirme 2"],
                "learning_resources": ["Kaynak 1", "Kaynak 2"]
            }}
            """
            
            response = await self.gemini_service.generate_text_response(
                prompt=prompt,
                system_instruction=system_instruction
            )
            
            if response["success"]:
                try:
                    # JSON yanıtını parse et
                    json_text = response["response"].strip()
                    if json_text.startswith("```json"):
                        json_text = json_text.replace("```json", "").replace("```", "").strip()
                    
                    recommendations = json.loads(json_text)
                    response["recommendations"] = recommendations
                    
                except json.JSONDecodeError:
                    response["recommendations"] = {
                        "productivity_tips": [],
                        "feature_suggestions": [],
                        "workflow_improvements": [],
                        "learning_resources": []
                    }
            
            return response
            
        except Exception as e:
            logger.error(f"Recommendations hatası: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }

# Singleton instance
_ai_assistant_service = None

def get_ai_assistant_service() -> AIAssistantService:
    """AI asistan servisi singleton instance'ı döndürür"""
    global _ai_assistant_service
    if _ai_assistant_service is None:
        _ai_assistant_service = AIAssistantService()
    return _ai_assistant_service
