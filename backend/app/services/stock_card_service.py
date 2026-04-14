"""



Stok Kartı Servisi



Mikro SQL'den stok kartı bilgilerini senkronize ve sunan servis



"""







import json



import logging



from datetime import datetime, timezone



from typing import Any, Dict, List, Optional



from uuid import uuid4







from app.integrations.mikro_sql_client import (
    MikroSQLClient,
    get_mikro_client,
    normalize_mikro_sql_config,
)



from app.models import StockCard, StockMovement



from app.services.base_service import BaseService



from app.services.integration_settings_service import IntegrationSettingsService



from sqlalchemy.orm import Session







logger = logging.getLogger(__name__)


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)











class StockCardService(BaseService[StockCard]):



    """Stok kartı yönetimi servisi"""







    def __init__(self, db: Session):



        super().__init__(db, StockCard)



        self.settings_service = IntegrationSettingsService(db)







    def get_by_id(self, id: str) -> Optional[StockCard]:



        """ID ile stok karti getir"""



        try:



            return (



                self.db.query(self.model)



                .filter(self.model.id == id, self.model.deleted_at.is_(None))



                .first()



            )



        except Exception as e:



            self._handle_error("get_by_id", e, id=id)



            raise







    def create(self, data: Dict[str, Any]) -> StockCard:
        """Stok karti olustur"""
        from app.exceptions import ValidationError as _ValidationError
        try:
            payload = dict(data)

            # Zorunlu alan doğrulaması
            stock_code = str(payload.get("stock_code") or "").strip()
            stock_name = str(payload.get("stock_name") or "").strip()
            unit = str(payload.get("unit") or "").strip()
            if not stock_code:
                raise _ValidationError("Stok kodu zorunludur")
            if not stock_name:
                raise _ValidationError("Stok adı zorunludur")
            if not unit:
                raise _ValidationError("Birim zorunludur")

            payload["stock_code"] = stock_code
            payload["stock_name"] = stock_name
            payload["unit"] = unit

            # Sayısal alanlar
            if "total_quantity" in payload:
                payload["total_quantity"] = self._ensure_non_negative(
                    payload["total_quantity"], "total_quantity"
                )
            if "available_quantity" in payload:
                payload["available_quantity"] = self._ensure_non_negative(
                    payload["available_quantity"], "available_quantity"
                )

            # Barkodlar ve satış fiyatları
            barkodlar = payload.pop("barkodlar", None)
            satis_fiyatlari = payload.pop("satis_fiyatlari", None)
            if barkodlar is not None:
                payload["barcodes"] = self._normalize_barcodes(barkodlar)
            if satis_fiyatlari is not None:
                payload["sale_prices"] = self._normalize_sale_prices(satis_fiyatlari)

            payload.setdefault("id", f"stk_{uuid4().hex[:12]}")
            payload.setdefault("available_quantity", payload.get("total_quantity", 0))

            instance = self.model(**payload)
            self.db.add(instance)
            self.db.commit()
            self.db.refresh(instance)
            return instance
        except Exception as e:
            self.db.rollback()
            self._handle_error("create", e, data=data)
            raise







    def update(self, id: str, data: Dict[str, Any]) -> Optional[StockCard]:
        """Stok karti guncelle"""
        from app.exceptions import ValidationError as _ValidationError
        try:
            instance = self.get_by_id(id)
            if not instance:
                return None

            payload = dict(data)

            # Boş değer kontrolü
            if "stock_name" in payload:
                val = str(payload["stock_name"] or "").strip()
                if not val:
                    raise _ValidationError("'stock_name' alanı boş olamaz")
                payload["stock_name"] = val
            if "stock_code" in payload:
                val = str(payload["stock_code"] or "").strip()
                if not val:
                    raise _ValidationError("'stock_code' alanı boş olamaz")
                payload["stock_code"] = val
            if "unit" in payload:
                val = str(payload["unit"] or "").strip()
                if not val:
                    raise _ValidationError("'unit' alanı boş olamaz")
                payload["unit"] = val

            for key, value in payload.items():
                if hasattr(instance, key):
                    setattr(instance, key, value)

            self.db.commit()
            self.db.refresh(instance)
            return instance
        except Exception as e:
            self.db.rollback()
            self._handle_error("update", e, id=id, data=data)
            raise







    def delete(self, id: str) -> bool:



        """Stok kartini soft delete yap"""



        try:



            instance = self.get_by_id(id)



            if not instance:



                return False







            instance.deleted_at = _utcnow_naive()



            instance.is_active = False



            self.db.commit()



            return True



        except Exception as e:



            self.db.rollback()



            self._handle_error("delete", e, id=id)



            raise







    def list(self, skip: int = 0, limit: int = 100) -> List[StockCard]:



        """Stok kartlarini sayfali listele"""



        try:



            limit = min(limit, 1000)



            skip = max(skip, 0)



            return (



                self.db.query(self.model)



                .filter(self.model.deleted_at.is_(None))



                .order_by(self.model.stock_name)



                .offset(skip)



                .limit(limit)



                .all()



            )



        except Exception as e:



            self._handle_error("list", e, skip=skip, limit=limit)



            raise







    def get_mikro_client(self) -> Optional[MikroSQLClient]:



        """Mikro SQL istemcisi al"""



        try:



            settings = self.settings_service.get_settings("MIKRO", "SQL")



            if not settings or not settings.get("settings"):



                logger.warning("Mikro SQL ayarları bulunamadı, kanonik config deneniyor")
                return get_mikro_client()







            config = normalize_mikro_sql_config(json.loads(settings["settings"]))



            return MikroSQLClient(config)



        except Exception as e:



            logger.error(f"Mikro client oluşturma hatası: {e}")
            try:
                return get_mikro_client()
            except Exception:
                return None







    def sync_stock_cards(self, limit: int = 100, offset: int = 0) -> Dict[str, Any]:



        """Stok kartlarını Mikro'dan senkronize et"""



        try:



            client = self.get_mikro_client()



            if not client:



                return {"success": False, "message": "Mikro bağlantısı kurulamadı"}







            if not client.connect():



                return {"success": False, "message": "Mikro SQL'e bağlanılamadı"}







            # Stokları al



            stocks = client.get_all_stocks(limit, offset)



            synced_count = 0



            updated_count = 0







            for stock in stocks:



                try:



                    stok_kod = stock.get("STOK_KOD")







                    # Existential kontrol



                    existing = (



                        self.db.query(StockCard).filter(StockCard.stock_code == stok_kod).first()



                    )







                    if existing:



                        # Güncelle



                        existing.stock_name = stock.get("STOK_ISIM", "")



                        existing.unit = stock.get("BIRIM", "Adet")



                        existing.purchase_price = stock.get("SATINALMA_FIYATI")



                        existing.sale_price = stock.get("SATIŞ_FIYATI")



                        existing.total_quantity = stock.get("MIKTAR", 0)



                        existing.thickness = stock.get("STOK_KALINLIK")



                        existing.color = stock.get("STOK_RENK")



                        existing.warehouse_location = stock.get("DEPO_YERI")



                        existing.last_sync_date = _utcnow_naive()



                        updated_count += 1



                    else:



                        # Yeni kayıt oluştur



                        new_card = StockCard(



                            id=f"stk_{uuid4().hex[:12]}",



                            stock_code=stok_kod,



                            stock_name=stock.get("STOK_ISIM", ""),



                            unit=stock.get("BIRIM", "Adet"),



                            purchase_price=stock.get("SATINALMA_FIYATI"),



                            sale_price=stock.get("SATIŞ_FIYATI"),



                            total_quantity=stock.get("MIKTAR", 0),



                            available_quantity=stock.get("MIKTAR", 0),



                            thickness=stock.get("STOK_KALINLIK"),



                            color=stock.get("STOK_RENK"),



                            warehouse_location=stock.get("DEPO_YERI"),



                            last_sync_date=_utcnow_naive(),



                        )



                        self.db.add(new_card)



                        synced_count += 1







                except Exception as e:



                    logger.error(f"Stok senkronize hatası {stok_kod}: {e}")



                    continue







            self.db.commit()



            client.disconnect()







            logger.info(f"Stok senkronizasyonu: {synced_count} yeni, {updated_count} güncellendi")



            return {



                "success": True,



                "synced": synced_count,



                "updated": updated_count,



                "total": synced_count + updated_count,



            }







        except Exception as e:



            logger.error(f"Stok senkronizasyonu hatası: {e}")



            self.db.rollback()



            return {"success": False, "message": str(e)}







    def search_stocks(self, search_text: str, limit: int = 20) -> List[Dict[str, Any]]:



        """Stok kartlarında arama (local)"""



        try:



            query = (



                self.db.query(StockCard)



                .filter(



                    (StockCard.stock_code.ilike(f"%{search_text}%"))



                    | (StockCard.stock_name.ilike(f"%{search_text}%"))



                    | (StockCard.color.ilike(f"%{search_text}%"))



                    | (StockCard.thickness.ilike(f"%{search_text}%"))



                )



                .limit(limit)



                .all()



            )







            return [self._card_to_dict(card) for card in query]







        except Exception as e:



            logger.error(f"Stok arama hatası: {e}")



            return []







    def get_stock_card(self, stock_code: str) -> Optional[Dict[str, Any]]:



        """Stok kartı detayını al"""



        try:



            card = self.db.query(StockCard).filter(StockCard.stock_code == stock_code).first()







            if not card:



                return None







            result = self._card_to_dict(card)







            # Son hareketleri ekle



            movements = (



                self.db.query(StockMovement)



                .filter(StockMovement.stock_code == stock_code)



                .order_by(StockMovement.movement_date.desc())



                .limit(20)



                .all()



            )







            result["movements"] = [self._movement_to_dict(m) for m in movements]







            return result







        except Exception as e:



            logger.error(f"Stok kartı okuma hatası: {e}")



            return None







    def sync_stock_movements(self, stock_code: str, days: int = 30) -> Dict[str, Any]:



        """Stok hareketlerini Mikro'dan senkronize et"""



        try:



            client = self.get_mikro_client()



            if not client:



                return {"success": False, "message": "Mikro bağlantısı kurulamadı"}







            if not client.connect():



                return {"success": False, "message": "Mikro SQL'e bağlanılamadı"}







            movements = client.get_stock_movements(stock_code, days)



            synced_count = 0







            for move in movements:



                try:



                    # Duplicate kontrolü



                    existing = (



                        self.db.query(StockMovement)



                        .filter(StockMovement.id == move.get("HAREKET_ID"))



                        .first()



                    )







                    if not existing:



                        new_movement = StockMovement(



                            id=f"mov_{uuid4().hex[:12]}",



                            stock_code=stock_code,



                            movement_type=move.get("HAREKET_TIP", "UNKNOWN"),



                            quantity=move.get("MIKTAR", 0),



                            unit_price=move.get("BIRIM_MALIYET"),



                            total_amount=move.get("TOPLAM_MALIYET"),



                            reference_document=move.get("REFERANS_TIP"),



                            reference_id=move.get("REFERANS_NO"),



                            description=move.get("ACIKLAMA"),



                            movement_date=move.get("HAREKET_TARIHI", _utcnow_naive()),



                        )



                        self.db.add(new_movement)



                        synced_count += 1







                except Exception as e:



                    logger.error(f"Hareket senkronize hatası: {e}")



                    continue







            self.db.commit()



            client.disconnect()







            logger.info(f"Hareket senkronizasyonu: {synced_count} yeni kayıt")



            return {"success": True, "synced": synced_count}







        except Exception as e:



            logger.error(f"Hareket senkronizasyonu hatası: {e}")



            self.db.rollback()



            return {"success": False, "message": str(e)}







    def get_stock_list(



        self, skip: int = 0, limit: int = 50, is_active: Optional[bool] = None



    ) -> List[Dict[str, Any]]:



        """Stok kartlarının listesini al (sayfalandırılmış)"""



        try:



            query = self.db.query(StockCard)







            if is_active is not None:



                query = query.filter(StockCard.is_active == is_active)







            cards = query.order_by(StockCard.stock_name).offset(skip).limit(limit).all()







            return [self._card_to_dict(card) for card in cards]







        except Exception as e:



            logger.error(f"Stok listesi okuma hatası: {e}")



            return []







    def get_low_stock_items(self, threshold_quantity: float = 10) -> List[Dict[str, Any]]:



        """Düşük stok uyarısı (miktarı eşikten az)"""



        try:



            cards = (



                self.db.query(StockCard)



                .filter(



                    StockCard.available_quantity < threshold_quantity, StockCard.is_active == True



                )



                .all()



            )







            return [self._card_to_dict(card) for card in cards]







        except Exception as e:



            logger.error(f"Düşük stok sorgusu hatası: {e}")



            return []







    def get_stock_summary_stats(self) -> Dict[str, Any]:



        """Stok genel istatistikleri"""



        try:



            total_cards = self.db.query(StockCard).count()



            total_quantity = self.db.query(StockCard).filter(StockCard.is_active == True).first()







            active_cards = self.db.query(StockCard).filter(StockCard.is_active == True).count()







            recent_movements = (



                self.db.query(StockMovement)



                .order_by(StockMovement.movement_date.desc())



                .limit(1)



                .first()



            )







            return {



                "total_stock_cards": total_cards,



                "active_stock_cards": active_cards,



                "inactive_stock_cards": total_cards - active_cards,



                "last_movement_date": recent_movements.movement_date if recent_movements else None,



                "total_stock_movements": self.db.query(StockMovement).count(),



            }







        except Exception as e:



            logger.error(f"İstatistik hesaplama hatası: {e}")



            return {}







    # ─── Doğrulama yardımcıları ───────────────────────────────────────────────

    @staticmethod
    def _ensure_non_negative(value: Any, field_name: str) -> float:
        """Değerin sayısal ve negatif olmadığını kontrol et; float döndür."""
        from app.exceptions import ValidationError as _ValidationError
        try:
            numeric = float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            raise _ValidationError(f"'{field_name}' alanı sayısal olmalıdır")
        if numeric < 0:
            raise _ValidationError(f"'{field_name}' alanı negatif olamaz")
        return numeric

    def _normalize_barcodes(self, data: Any) -> List[str]:
        """Barkod listesini normalize et ve doğrula."""
        from app.exceptions import ValidationError as _ValidationError
        if data is None:
            return []
        if not isinstance(data, list):
            raise _ValidationError("Barkodlar dizi olmalıdır")
        seen: set = set()
        result: List[str] = []
        for item in data:
            if isinstance(item, dict):
                code = str(item.get("barcode", "") or "").strip()
            else:
                code = str(item).strip() if item is not None else ""
            if not code:
                raise _ValidationError("Barkod boş olamaz")
            lower = code.lower()
            if lower in seen:
                raise _ValidationError("Aynı barkod bir stok kartında tekrar edemez")
            seen.add(lower)
            result.append(code)
        return result

    def _normalize_sale_prices(self, data: Any) -> List[Dict[str, Any]]:
        """Satış fiyatı listesini normalize et ve doğrula."""
        from app.exceptions import ValidationError as _ValidationError
        if data is None:
            return []
        if not isinstance(data, list):
            raise _ValidationError("Satış fiyatları dizi olmalıdır")
        seen: set = set()
        result: List[Dict[str, Any]] = []
        for item in data:
            if not isinstance(item, dict):
                raise _ValidationError("Her satış fiyatı nesne olmalıdır")
            price_type = str(item.get("price_type", "") or "").strip()
            if not price_type:
                raise _ValidationError("Fiyat tipi zorunludur")
            lower = price_type.lower()
            if lower in seen:
                raise _ValidationError("Aynı fiyat tipi bir stok kartında tekrar edemez")
            seen.add(lower)
            amount = self._ensure_non_negative(item.get("amount", 0), "amount")
            result.append({"price_type": price_type, "amount": amount})
        return result

    def _card_to_dict(self, card: StockCard) -> Dict[str, Any]:



        """Stok kartı nesnesi sözlüğe dönüştür"""



        return {



            "id": card.id,



            "stock_code": card.stock_code,



            "stock_name": card.stock_name,



            "unit": card.unit,



            "purchase_price": float(card.purchase_price) if card.purchase_price else None,



            "sale_price": float(card.sale_price) if card.sale_price else None,



            "total_quantity": float(card.total_quantity),



            "available_quantity": float(card.available_quantity),



            "reserved_quantity": float(card.reserved_quantity),



            "warehouse_location": card.warehouse_location,



            "thickness": card.thickness,



            "color": card.color,



            "is_active": card.is_active,



            "last_sync_date": card.last_sync_date.isoformat() if card.last_sync_date else None,



            "created_at": card.created_at.isoformat(),



            "updated_at": card.updated_at.isoformat(),
            "barkodlar": [{"barcode": bc} for bc in (card.barcodes or [])],
            "satis_fiyatlari": list(card.sale_prices or []),



        }







    def _movement_to_dict(self, movement: StockMovement) -> Dict[str, Any]:



        """Stok hareketi nesnesi sözlüğe dönüştür"""



        return {



            "id": movement.id,



            "stock_code": movement.stock_code,



            "movement_type": movement.movement_type,



            "quantity": float(movement.quantity),



            "unit_price": float(movement.unit_price) if movement.unit_price else None,



            "total_amount": float(movement.total_amount) if movement.total_amount else None,



            "reference_document": movement.reference_document,



            "reference_id": movement.reference_id,



            "description": movement.description,



            "movement_date": movement.movement_date.isoformat() if movement.movement_date else None,



            "created_at": movement.created_at.isoformat(),



        }



