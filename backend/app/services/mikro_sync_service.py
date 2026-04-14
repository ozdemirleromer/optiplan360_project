


import json



import logging



import uuid



from datetime import datetime, timezone



from typing import Any, Dict, List, Optional







from sqlalchemy.orm import Session







from ..integrations.mikro_sql_client import MikroSQLClient, get_mikro_client



from ..models import (

    CRMAccount,



    IntegrationEntityMap,



    IntegrationError,



    IntegrationInbox,



    SyncStatusEnum,



)







logger = logging.getLogger(__name__)











class MikroSyncService:



    """Mikro SQL senkronizasyon servisi"""







    def __init__(self, db: Session, mikro_client: Optional[MikroSQLClient] = None):



        self.db = db



        self.mikro_client = mikro_client or get_mikro_client()



        if not hasattr(self.mikro_client, "read_only_mode"):



            # P1 default: read-only zorunlu.



            self.mikro_client.read_only_mode = True







    def _is_read_only_mode(self) -> bool:



        return bool(getattr(self.mikro_client, "read_only_mode", True))







    def _read_only_block(self, entity_type: str, entity_id: str, operation: str) -> Dict[str, Any]:



        message = (



            "Mikro P1 read-only mod aktif. "



            f"Yazma islemi engellendi: {operation}. "



            "PUSH yerine PULL/read-only akislarini kullanin."



        )



        logger.warning("Mikro read-only engeli: %s (%s)", operation, entity_id)



        self._log_error(entity_type, entity_id, message)



        return {"success": False, "error": message, "code": "E_MIKRO_READ_ONLY"}







    # ═══════════════════════════════════════════════════════════



    # CARİ HESAP SENKRONIZASYONU



    # ═══════════════════════════════════════════════════════════







    def sync_account_to_mikro(



        self, account_id: str, account_data: Dict[str, Any]



    ) -> Dict[str, Any]:



        """



        CRM Account → Mikro Cari Hesap (PUSH)







        Args:



            account_id: OptiPlan account UUID



            account_data: Account verileri







        Returns:



            {"success": bool, "mikro_cari_kod": str, "message": str}



        """



        if self._is_read_only_mode():



            return self._read_only_block("ACCOUNT", account_id, "sync_account_to_mikro")







        try:



            # Mapping kontrolü



            mapping = (



                self.db.query(IntegrationEntityMap)



                .filter_by(entity_type="ACCOUNT", internal_id=account_id)



                .first()



            )







            # Mikro data hazırla



            mikro_data = {



                "CARI_KOD": (



                    account_data.get("mikro_cari_kod") or mapping.external_id if mapping else None



                ),



                "CARI_UNVAN": account_data.get("company_name"),



                "VERGI_NO": account_data.get("tax_id"),



                "VERGI_DAIRESI": account_data.get("tax_office"),



                "TELEFON1": account_data.get("phone"),



                "EMAIL": account_data.get("email"),



                "ADRES": account_data.get("address"),



                "IL": account_data.get("city"),



                "ILCE": account_data.get("district"),



                "KREDI_LIMIT": account_data.get("credit_limit", 0.0),



                "BAKIYE": account_data.get("balance", 0.0),



            }







            if not self.mikro_client.connection:



                self.mikro_client.connect()







            if mapping:



                # UPDATE



                success = self.mikro_client.update_account(mapping.external_id, mikro_data)



                if success:



                    mapping.last_synced_at = datetime.now(timezone.utc)



                    self.db.commit()



                    return {



                        "success": True,



                        "mikro_cari_kod": mapping.external_id,



                        "message": "Güncellendi",



                    }



            else:



                # CREATE



                cari_kod = self.mikro_client.create_account(mikro_data)



                if cari_kod:



                    # Mapping oluştur



                    new_mapping = IntegrationEntityMap(



                        id=str(uuid.uuid4()),



                        entity_type="ACCOUNT",



                        internal_id=account_id,



                        external_id=cari_kod,



                        external_system="MIKRO",



                        last_synced_at=datetime.now(timezone.utc),



                    )



                    self.db.add(new_mapping)



                    self.db.commit()



                    return {"success": True, "mikro_cari_kod": cari_kod, "message": "Oluşturuldu"}







            return {"success": False, "error": "Mikro işlemi başarısız"}







        except Exception as e:



            logger.error(f"Account sync hatası: {e}")



            self._log_error("ACCOUNT", account_id, str(e))



            return {"success": False, "error": str(e)}







    def sync_account_from_mikro(self, cari_kod: str) -> Dict[str, Any]:



        """



        Mikro Cari Hesap → OptiPlan Account (PULL)



        """



        try:



            if not self.mikro_client.connection:



                self.mikro_client.connect()







            # Mikro'dan çek



            mikro_account = self.mikro_client.get_account(cari_kod)



            if not mikro_account:



                return {"success": False, "error": "Mikro'da cari bulunamadı"}







            # Mapping bul



            mapping = (



                self.db.query(IntegrationEntityMap)



                .filter_by(entity_type="ACCOUNT", external_id=cari_kod)



                .first()



            )







            if mapping:
                account = self.db.query(CRMAccount).filter_by(id=mapping.internal_id).first()
                if not account:
                    return {"success": False, "error": "OptiPlan'da eşlenmiş cari bulunamadı"}

                def _to_float(value: Any) -> Optional[float]:
                    if value in (None, ""):
                        return None
                    try:
                        return float(value)
                    except (TypeError, ValueError):
                        return None

                account.company_name = (
                    mikro_account.get("CARI_UNVAN")
                    or mikro_account.get("CARI_UNVAN1")
                    or account.company_name
                )
                account.tax_id = mikro_account.get("VERGI_NO") or account.tax_id
                account.tax_office = mikro_account.get("VERGI_DAIRESI") or account.tax_office
                account.phone = (
                    mikro_account.get("TELEFON1")
                    or mikro_account.get("TEL")
                    or account.phone
                )
                account.email = (
                    mikro_account.get("EMAIL")
                    or mikro_account.get("E_MAIL")
                    or account.email
                )
                account.address = mikro_account.get("ADRES") or account.address
                account.city = mikro_account.get("IL") or account.city
                account.district = mikro_account.get("ILCE") or account.district
                account.mikro_cari_kod = cari_kod

                credit_limit = _to_float(mikro_account.get("KREDI_LIMIT"))
                if credit_limit is not None:
                    account.credit_limit = credit_limit

                balance = _to_float(mikro_account.get("BAKIYE"))
                if balance is not None:
                    account.balance = balance

                logger.info(f"Account {mapping.internal_id} Mikro'dan güncellendi")
                mapping.last_synced_at = datetime.now(timezone.utc)
                self.db.commit()

                return {
                    "success": True,
                    "account_id": mapping.internal_id,
                    "message": "Güncellendi",
                }



            else:



                # Yeni account oluştur (Inbox'a koy)



                inbox_record = IntegrationInbox(



                    id=str(uuid.uuid4()),



                    entity_type="ACCOUNT",



                    external_id=cari_kod,



                    operation="CREATE",



                    payload=json.dumps(mikro_account, default=str),



                    status=SyncStatusEnum.QUEUED,



                )



                self.db.add(inbox_record)



                self.db.commit()



                return {"success": True, "message": "Inbox'a eklendi"}







        except Exception as e:



            logger.error(f"Account pull hatası: {e}")



            return {"success": False, "error": str(e)}







    # ═══════════════════════════════════════════════════════════



    # FATURA SENKRONIZASYONU



    # ═══════════════════════════════════════════════════════════







    def sync_invoice_to_mikro(



        self, invoice_id: str, invoice_data: Dict[str, Any], invoice_lines: List[Dict]



    ) -> Dict[str, Any]:



        """Invoice → Mikro Fatura (PUSH)"""



        if self._is_read_only_mode():



            return self._read_only_block("INVOICE", invoice_id, "sync_invoice_to_mikro")







        try:



            # Account mapping



            account_mapping = (



                self.db.query(IntegrationEntityMap)



                .filter_by(entity_type="ACCOUNT", internal_id=invoice_data.get("account_id"))



                .first()



            )







            if not account_mapping:



                return {"success": False, "error": "Cari hesap Mikro'ya senkronize edilmemiş"}







            # Invoice mapping



            inv_mapping = (



                self.db.query(IntegrationEntityMap)



                .filter_by(entity_type="INVOICE", internal_id=invoice_id)



                .first()



            )







            mikro_data = {



                "FATURA_NO": (



                    invoice_data.get("mikro_fatura_no") or inv_mapping.external_id



                    if inv_mapping



                    else f"FTR-{datetime.now().strftime('%Y%m%d%H%M%S')}"



                ),



                "CARI_KOD": account_mapping.external_id,



                "FATURA_TARIH": invoice_data.get("invoice_date"),



                "VADE_TARIH": invoice_data.get("due_date"),



                "TUTAR": invoice_data.get("subtotal"),



                "KDV_ORAN": invoice_data.get("tax_rate"),



                "KDV_TUTAR": invoice_data.get("tax_amount"),



                "GENEL_TOPLAM": invoice_data.get("total_amount"),



                "DURUM": invoice_data.get("status"),



                "ACIKLAMA": invoice_data.get("notes"),



            }







            if not self.mikro_client.connection:



                self.mikro_client.connect()







            fatura_no = self.mikro_client.create_invoice(mikro_data)



            if not fatura_no:



                return {"success": False, "error": "Fatura oluşturulamadı"}







            # Satırları ekle



            for idx, line in enumerate(invoice_lines, 1):



                line_data = {



                    "FATURA_NO": fatura_no,



                    "SIRA_NO": idx,



                    "STOK_KOD": line.get("product_code"),



                    "ACIKLAMA": line.get("description"),



                    "MIKTAR": line.get("quantity"),



                    "BIRIM": line.get("unit", "Adet"),



                    "BIRIM_FIYAT": line.get("unit_price"),



                    "TUTAR": line.get("line_total"),



                }



                self.mikro_client.create_invoice_line(line_data)







            # Mapping kaydet



            if not inv_mapping:



                inv_mapping = IntegrationEntityMap(



                    id=str(uuid.uuid4()),



                    entity_type="INVOICE",



                    internal_id=invoice_id,



                    external_id=fatura_no,



                    external_system="MIKRO",



                    last_synced_at=datetime.now(timezone.utc),



                )



                self.db.add(inv_mapping)



            else:



                inv_mapping.last_synced_at = datetime.now(timezone.utc)







            self.db.commit()



            return {



                "success": True,



                "mikro_fatura_no": fatura_no,



                "lines_synced": len(invoice_lines),



            }







        except Exception as e:



            logger.error(f"Invoice sync hatası: {e}")



            self._log_error("INVOICE", invoice_id, str(e))



            return {"success": False, "error": str(e)}







    # ═══════════════════════════════════════════════════════════



    # TEKLİF SENKRONIZASYONU



    # ═══════════════════════════════════════════════════════════







    def sync_quote_to_mikro(



        self, quote_id: str, quote_data: Dict[str, Any], quote_lines: List[Dict]



    ) -> Dict[str, Any]:



        """Quote → Mikro Teklif (PUSH)"""



        if self._is_read_only_mode():



            return self._read_only_block("QUOTE", quote_id, "sync_quote_to_mikro")







        try:



            # Account mapping



            account_mapping = (



                self.db.query(IntegrationEntityMap)



                .filter_by(entity_type="ACCOUNT", internal_id=quote_data.get("account_id"))



                .first()



            )







            if not account_mapping:



                return {"success": False, "error": "Cari hesap Mikro'ya senkronize edilmemiş"}







            quote_mapping = (



                self.db.query(IntegrationEntityMap)



                .filter_by(entity_type="QUOTE", internal_id=quote_id)



                .first()



            )







            mikro_data = {



                "TEKLIF_NO": (



                    quote_data.get("mikro_teklif_no") or quote_mapping.external_id



                    if quote_mapping



                    else f"TKL-{datetime.now().strftime('%Y%m%d%H%M%S')}"



                ),



                "REVIZYON": quote_data.get("revision", 1),



                "BASLIK": quote_data.get("title"),



                "CARI_KOD": account_mapping.external_id,



                "TEKLIF_TARIH": quote_data.get("created_at"),



                "GECERLILIK_TARIH": quote_data.get("valid_until"),



                "DURUM": quote_data.get("status"),



                "TUTAR": quote_data.get("subtotal"),



                "KDV_ORAN": quote_data.get("tax_rate"),



                "KDV_TUTAR": quote_data.get("tax_amount"),



                "ISKONTO_ORAN": quote_data.get("discount_rate", 0),



                "ISKONTO_TUTAR": quote_data.get("discount_amount", 0),



                "GENEL_TOPLAM": quote_data.get("total"),



                "ACIKLAMA": quote_data.get("notes"),



            }







            if not self.mikro_client.connection:



                self.mikro_client.connect()







            # Mevcut satırları sil



            if quote_mapping:



                self.mikro_client.delete_quote_lines(quote_mapping.external_id)







            teklif_no = self.mikro_client.create_quote(mikro_data)



            if not teklif_no:



                return {"success": False, "error": "Teklif oluşturulamadı"}







            # Satırları ekle



            for idx, line in enumerate(quote_lines, 1):



                line_data = {



                    "TEKLIF_NO": teklif_no,



                    "SIRA_NO": idx,



                    "STOK_KOD": line.get("mikro_stok_kod", line.get("product_code")),



                    "ACIKLAMA": line.get("description"),



                    "MIKTAR": line.get("quantity"),



                    "BIRIM": line.get("unit", "Adet"),



                    "BIRIM_FIYAT": line.get("unit_price"),



                    "ISKONTO_ORAN": line.get("discount_rate", 0),



                    "TUTAR": line.get("line_total"),



                    "MALZEME": line.get("material_name"),



                    "RENK": line.get("color"),



                    "KALINLIK": line.get("thickness_mm"),



                    "OLCU": line.get("dimensions"),



                    "DAMAR_YON": line.get("grain_direction", 0),



                    "BANT_DAHIL": line.get("band_included", False),



                    "DELME_DAHIL": line.get("drilling_included", False),



                }



                self.mikro_client.create_quote_line(line_data)







            # Mapping kaydet



            if not quote_mapping:



                quote_mapping = IntegrationEntityMap(



                    id=str(uuid.uuid4()),



                    entity_type="QUOTE",



                    internal_id=quote_id,



                    external_id=teklif_no,



                    external_system="MIKRO",



                    last_synced_at=datetime.now(timezone.utc),



                )



                self.db.add(quote_mapping)



            else:



                quote_mapping.last_synced_at = datetime.now(timezone.utc)







            self.db.commit()



            return {"success": True, "mikro_teklif_no": teklif_no, "lines_synced": len(quote_lines)}







        except Exception as e:



            logger.error(f"Quote sync hatası: {e}")



            self._log_error("QUOTE", quote_id, str(e))



            return {"success": False, "error": str(e)}







    # ═══════════════════════════════════════════════════════════



    # SİPARİŞ SENKRONIZASYONU



    # ═══════════════════════════════════════════════════════════







    def sync_order_to_mikro(



        self, order_id: str, order_data: Dict[str, Any], order_items: List[Dict]



    ) -> Dict[str, Any]:



        """Order → Mikro Sipariş (PUSH)"""



        if self._is_read_only_mode():



            return self._read_only_block("ORDER", str(order_id), "sync_order_to_mikro")







        try:



            # Customer mapping (phone bazlı)



            # Burada customer'ı account'a map etmek gerekebilir







            order_mapping = (



                self.db.query(IntegrationEntityMap)



                .filter_by(entity_type="ORDER", internal_id=order_id)



                .first()

            )

            account_code = order_data.get("mikro_cari_kod")
            if not account_code and order_data.get("crm_account_id"):
                crm_account = (
                    self.db.query(CRMAccount)
                    .filter_by(id=order_data.get("crm_account_id"))
                    .first()
                )
                account_code = crm_account.mikro_cari_kod if crm_account else None

            if not account_code:
                return {
                    "success": False,
                    "error": "Cari kodu olmadan ticari sipariş aktarımı tamamlanamaz",
                    "code": "E_ORDER_ACCOUNT_REQUIRED",
                }

            delivery_date = order_data.get("delivery_date")
            if not delivery_date:
                return {
                    "success": False,
                    "error": "Teslim tarihi olmadan ticari sipariş aktarımı tamamlanamaz",
                    "code": "E_ORDER_DELIVERY_DATE_REQUIRED",
                }

            delivery_address = order_data.get("delivery_address") or order_data.get("shipping_address")
            if not delivery_address:
                return {
                    "success": False,
                    "error": "Teslimat adresi olmadan ticari sipariş aktarımı tamamlanamaz",
                    "code": "E_ORDER_DELIVERY_ADDRESS_REQUIRED",
                }

            payment_method = order_data.get("payment_method")
            if not payment_method:
                return {
                    "success": False,
                    "error": "Odeme sekli olmadan ticari sipariş aktarımı tamamlanamaz",
                    "code": "E_ORDER_PAYMENT_METHOD_REQUIRED",
                }

            for item in order_items:
                stock_code = item.get("stok_kod") or item.get("mikro_stok_kod") or item.get("product_code")
                if not stock_code:
                    item_identifier = item.get("id") or "unknown"
                    return {
                        "success": False,
                        "error": f"Stok kodu olmadan sipariş satiri aktarımı tamamlanamaz: {item_identifier}",
                        "code": "E_ORDER_STOCK_REQUIRED",
                    }







            mikro_data = {



                "SIPARIS_NO": (



                    order_data.get("mikro_siparis_no") or order_mapping.external_id



                    if order_mapping



                    else f"SIP-{datetime.now().strftime('%Y%m%d%H%M%S')}"



                ),



                "CARI_KOD": account_code,



                "SIPARIS_TARIH": order_data.get("created_at"),



                "TESLIM_TARIH": delivery_date,



                "DURUM": order_data.get("status"),



                "TUTAR": order_data.get("subtotal", 0),



                "KDV_TUTAR": order_data.get("tax_amount", 0),



                "ISKONTO_TUTAR": order_data.get("discount_amount", 0),



                "GENEL_TOPLAM": order_data.get("total", order_data.get("total_amount", 0)),



                "ACIKLAMA": order_data.get("general_note", order_data.get("notes")),



                "TESLIMAT_ADRES": delivery_address,



                "ODEME_SEKLI": payment_method,



            }







            if not self.mikro_client.connection:



                self.mikro_client.connect()







            # Mevcut satırları sil



            if order_mapping:



                self.mikro_client.delete_order_lines(order_mapping.external_id)







            siparis_no = self.mikro_client.create_order(mikro_data)



            if not siparis_no:



                return {"success": False, "error": "Sipariş oluşturulamadı"}







            # Satırları ekle



            for idx, item in enumerate(order_items, 1):



                line_data = {



                    "SIPARIS_NO": siparis_no,



                    "SIRA_NO": idx,



                    "STOK_KOD": item.get("stok_kod") or item.get("mikro_stok_kod") or item.get("product_code"),



                    "ACIKLAMA": item.get("part_desc") or item.get("description", ""),



                    "MIKTAR": item.get("adet", item.get("quantity", 1)),



                    "BIRIM": "Adet",



                    "BIRIM_FIYAT": item.get("unit_price", 0),



                    "ISKONTO_ORAN": 0,



                    "TUTAR": item.get("line_total", item.get("total_price", 0)),



                    "MALZEME": item.get("material_name", ""),



                    "RENK": item.get("color", ""),



                    "OLCU": f"{item.get('boy_mm', item.get('width_mm', 0))}x{item.get('en_mm', item.get('height_mm', 0))}",



                }



                self.mikro_client.create_order_line(line_data)







            # Mapping kaydet



            if not order_mapping:



                order_mapping = IntegrationEntityMap(



                    id=str(uuid.uuid4()),



                    entity_type="ORDER",



                    internal_id=str(order_id),



                    external_id=siparis_no,



                    external_system="MIKRO",



                    last_synced_at=datetime.now(timezone.utc),



                )



                self.db.add(order_mapping)



            else:



                order_mapping.last_synced_at = datetime.now(timezone.utc)







            self.db.commit()



            return {



                "success": True,



                "mikro_siparis_no": siparis_no,



                "lines_synced": len(order_items),



            }







        except Exception as e:



            logger.error(f"Order sync hatası: {e}")



            self._log_error("ORDER", str(order_id), str(e))



            return {"success": False, "error": str(e)}







    # ═══════════════════════════════════════════════════════════



    # YARDIMCI FONKSİYONLAR



    # ═══════════════════════════════════════════════════════════







    def _log_error(self, entity_type: str, entity_id: str, error_message: str):



        """Hata kaydı oluştur"""



        try:



            error_record = IntegrationError(



                id=str(uuid.uuid4()),



                entity_type=entity_type,



                entity_id=entity_id,



                error_message=error_message,



                is_resolved=False,



            )



            self.db.add(error_record)



            self.db.commit()



        except Exception as e:



            logger.error(f"Hata kaydı oluşturulamadı: {e}")



