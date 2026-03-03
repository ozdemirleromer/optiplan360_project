"""


OptiPlan360 — WhatsApp Service


İş mantığı katmanı: mesaj gönderim, config yönetimi, şablon yönetimi.


Router'dan çağrılır, doğrudan HTTP işlemi yapmaz.


"""





import logging


import re


from datetime import datetime, timezone


from typing import Optional


from uuid import uuid4





import httpx


from app.exceptions import AuthorizationError, BusinessRuleError


from app.models import (


    AuditLog,


    Customer,


    Order,


    User,


    WhatsAppMessage,


    WhatsAppSetting,


)


from app.permissions import Permission, has_permission


from sqlalchemy import func


from sqlalchemy.orm import Session





logger = logging.getLogger(__name__)





# ── Mesaj Şablonları ──────────────────────────────────────





TEMPLATES = {


    "order_ready": {


        "name": "order_ready",


        "label": "Sipariş Hazır",


        "body": "Merhaba {customer_name}, {ts_code} kodlu siparişiniz hazırlanmıştır. Teslim almak için lütfen fabrikamıza geliniz. Takip linki: {tracking_link}",


        "variables": ["customer_name", "ts_code", "tracking_link"],


    },


    "order_confirmed": {


        "name": "order_confirmed",


        "label": "Sipariş Onaylandı",


        "body": "Merhaba {customer_name}, {ts_code} kodlu siparişiniz onaylandı ve üretime alınmıştır. Sipariş durumunuzu anlık takip etmek için tıklayın: {tracking_link}",


        "variables": ["customer_name", "ts_code", "tracking_link"],


    },


    "order_delivered": {


        "name": "order_delivered",


        "label": "Teslim Edildi",


        "body": "Merhaba {customer_name}, {ts_code} kodlu siparişiniz teslim edilmiştir. Bizi tercih ettiğiniz için teşekkürler!",


        "variables": ["customer_name", "ts_code"],


    },


    "custom": {


        "name": "custom",


        "label": "Özel Mesaj",


        "body": "{message}",


        "variables": ["message"],


    },


}








# ── DB Config Yardımcıları ────────────────────────────────








def _get_setting(db: Session, key: str, default: str = "") -> str:


    row = db.query(WhatsAppSetting).filter(WhatsAppSetting.key == key).first()


    return row.value if row else default








def _set_setting(db: Session, key: str, value: str) -> None:


    row = db.query(WhatsAppSetting).filter(WhatsAppSetting.key == key).first()


    if row:


        row.value = value


        row.updated_at = datetime.now(timezone.utc)


    else:


        db.add(WhatsAppSetting(key=key, value=value, updated_at=datetime.now(timezone.utc)))








def _is_configured(db: Session) -> bool:


    pid = _get_setting(db, "phone_number_id")


    token = _get_setting(db, "access_token")


    return bool(pid and token)








def _create_audit_log(


    db: Session,


    user_id: Optional[str],


    action: str,


    detail: str,


    order_id: Optional[str] = None,


) -> None:


    """Audit log oluştur — WhatsApp işlemleri için yardımcı"""


    log = AuditLog(


        id=str(uuid4()),


        user_id=user_id,


        order_id=order_id,


        action=action,


        detail=detail,


        created_at=datetime.now(timezone.utc),


    )


    db.add(log)








# ── Telefon Normalizasyonu ────────────────────────────────








def normalize_phone_number(phone: str) -> Optional[str]:


    """


    Türk telefon numarasını normalize eder.


    05xx xxx xx xx → 905xxxxxxxxx


    """


    if not phone:


        return None





    digits = re.sub(r"\D", "", phone)





    if len(digits) == 10 and digits.startswith("5"):


        return f"90{digits}"


    elif len(digits) == 11 and digits.startswith("0"):


        return f"90{digits[1:]}"


    elif len(digits) == 12 and digits.startswith("90"):


        return digits





    return None








# ── Mesai Saati Kontrolü ──────────────────────────────────








def is_within_working_hours() -> bool:


    """Mesai saatleri içinde mi kontrol eder (09:00-18:00 Türkiye)"""


    now = datetime.now()


    return 9 <= now.hour < 18








# ── RBAC Kontrolleri ──────────────────────────────────────








def _assert_whatsapp_permission(user: User, permission: Permission) -> None:


    """WhatsApp izin kontrolü"""


    role = (user.role or "").upper()


    if role == "ADMIN":


        return


    if not has_permission(role, permission):


        raise AuthorizationError(f"Bu WhatsApp işlemi için yetkiniz yok: {permission.value}")








# ═══════════════════════════════════════════════════


# SERVİS FONKSİYONLARI


# ═══════════════════════════════════════════════════








def get_config(db: Session, user: User) -> dict:


    """WhatsApp yapılandırmasını getir (token gizli)"""


    _assert_whatsapp_permission(user, Permission.WHATSAPP_VIEW)


    return {


        "configured": _is_configured(db),


        "phone_number_id": _get_setting(db, "phone_number_id"),


        "business_account_id": _get_setting(db, "business_account_id"),


        "api_version": _get_setting(db, "api_version", "v18.0"),


    }








def update_config(


    db: Session,


    user: User,


    phone_number_id: str = "",


    business_account_id: str = "",


    access_token: str = "",


    api_version: str = "v18.0",


) -> dict:


    """WhatsApp yapılandırmasını güncelle — sadece ADMIN"""


    _assert_whatsapp_permission(user, Permission.WHATSAPP_CONFIG)





    if phone_number_id:


        _set_setting(db, "phone_number_id", phone_number_id)


    if business_account_id:


        _set_setting(db, "business_account_id", business_account_id)


    if access_token:


        _set_setting(db, "access_token", access_token)


    if api_version:


        _set_setting(db, "api_version", api_version)





    _create_audit_log(db, user.id, "WHATSAPP_CONFIG_UPDATE", "WhatsApp yapılandırması güncellendi")


    db.commit()





    return {


        "configured": _is_configured(db),


        "phone_number_id": _get_setting(db, "phone_number_id"),


        "business_account_id": _get_setting(db, "business_account_id"),


        "api_version": _get_setting(db, "api_version", "v18.0"),


    }








def get_templates() -> list[dict]:


    """Mesaj şablonlarını listele"""


    return list(TEMPLATES.values())








async def send_message(


    db: Session,


    user: User,


    to_phone: str,


    template_name: Optional[str] = None,


    message_text: Optional[str] = None,


    order_id: Optional[str] = None,


) -> dict:


    """WhatsApp mesajı gönder"""


    _assert_whatsapp_permission(user, Permission.WHATSAPP_SEND)





    # Sipariş bilgisi


    ts_code = None


    tracking_token = None


    customer_name = "Değerli Müşterimiz"


    if order_id:


        order = db.query(Order).filter(Order.id == order_id).first()


        if order:


            ts_code = order.ts_code


            tracking_token = getattr(order, "tracking_token", None)


            cust = db.query(Customer).filter(Customer.id == order.customer_id).first()


            if cust:


                customer_name = cust.name





    tracking_link = f"https://optiplan360.com/track/{tracking_token}" if tracking_token else ""





    # Mesaj metnini oluştur


    if template_name and template_name in TEMPLATES:


        template = TEMPLATES[template_name]


        try:


            msg = template["body"].format(


                customer_name=customer_name,


                ts_code=ts_code or "N/A",


                message=message_text or "",


                tracking_link=tracking_link,


            )


        except KeyError:


            # Fallback if unhandled fields are in template


            msg = template["body"].format(


                customer_name=customer_name,


                ts_code=ts_code or "N/A",


                message=message_text or "",


            )


    elif message_text:


        msg = message_text


    else:


        raise BusinessRuleError("Şablon veya mesaj metni gerekli")





    # DB kaydı oluştur


    wa_msg = WhatsAppMessage(


        id=str(uuid4()),


        to_phone=to_phone,


        message=msg,


        status="PENDING",


        order_id=order_id,


        order_ts_code=ts_code,


        sent_by_id=user.id,


        sent_by_name=user.display_name,


        sent_at=datetime.now(timezone.utc),


    )





    # WABA API'ye gönder


    if _is_configured(db):


        try:


            pid = _get_setting(db, "phone_number_id")


            token = _get_setting(db, "access_token")


            api_ver = _get_setting(db, "api_version", "v18.0")


            url = f"https://graph.facebook.com/{api_ver}/{pid}/messages"


            payload = {


                "messaging_product": "whatsapp",


                "to": to_phone,


                "type": "text",


                "text": {"body": msg},


            }


            async with httpx.AsyncClient() as client:


                resp = await client.post(


                    url,


                    json=payload,


                    headers={


                        "Authorization": f"Bearer {token}",


                        "Content-Type": "application/json",


                    },


                    timeout=10,


                )


                if resp.status_code == 200:


                    data = resp.json()


                    wa_msg.status = "SENT"


                    wa_msg.waba_message_id = data.get("messages", [{}])[0].get("id")


                else:


                    wa_msg.status = "FAILED"


                    wa_msg.error = resp.text[:200]


        except Exception as e:


            wa_msg.status = "FAILED"


            wa_msg.error = str(e)[:200]


            logger.error("WhatsApp API hatası: %s", e)


    else:


        # Config yoksa simüle et


        wa_msg.status = "SENT"


        wa_msg.waba_message_id = f"sim_{uuid4().hex[:8]}"





    db.add(wa_msg)


    _create_audit_log(


        db,


        user.id,


        "WHATSAPP_SEND",


        f"→ {to_phone}: {wa_msg.status} | {msg[:50]}...",


        order_id,


    )


    db.commit()





    return _msg_to_dict(wa_msg)








async def send_template_message(


    customer_phone: str,


    template_name: str,


    order: Order,


    db: Session,


    params: Optional[list] = None,


) -> None:


    """


    Meta WABA'ya şablon mesajı gönderir.


    Otomatik bildirimler (sipariş durumu değişikliği vb.) için kullanılır.


    """


    normalized_phone = normalize_phone_number(customer_phone)


    if not normalized_phone:


        _create_audit_log(


            db,


            None,


            "WHATSAPP_ERROR",


            f"Geçersiz telefon numarası: {customer_phone}",


            order.id,


        )


        db.commit()


        return





    if not _is_configured(db):


        logger.info(


            "WhatsApp yapılandırılmamış, simüle ediliyor: %s → %s", template_name, normalized_phone


        )


        _create_audit_log(


            db,


            None,


            "WHATSAPP_SIMULATED",


            f"Simüle: {template_name} → {normalized_phone}",


            order.id,


        )


        db.commit()


        return





    pid = _get_setting(db, "phone_number_id")


    token = _get_setting(db, "access_token")


    api_ver = _get_setting(db, "api_version", "v18.0")


    url = f"https://graph.facebook.com/{api_ver}/{pid}/messages"





    final_params = []


    for p in params or []:


        if p == "{{company_name}}":


            final_params.append({"type": "text", "text": "OPTIPLAN360"})


        elif p == "{{order_id}}":


            final_params.append({"type": "text", "text": order.ts_code or str(order.id)})


        elif p == "{{tracking_link}}":


            link = f"https://optiplan360.com/track/{getattr(order, 'tracking_token', '')}"


            final_params.append({"type": "text", "text": link})


        else:


            final_params.append({"type": "text", "text": str(p)})





    payload = {


        "messaging_product": "whatsapp",


        "to": normalized_phone,


        "type": "template",


        "template": {


            "name": template_name,


            "language": {"code": "tr"},


            "components": [{"type": "body", "parameters": final_params}] if final_params else [],


        },


    }





    async with httpx.AsyncClient() as client:


        try:


            response = await client.post(


                url,


                json=payload,


                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},


                timeout=10,


            )


            response.raise_for_status()


            _create_audit_log(


                db, None, "WHATSAPP_SENT", f"Mesaj gönderildi: {template_name}", order.id


            )


        except httpx.HTTPStatusError as e:


            error_data = e.response.json() if e.response else {}


            error_message = error_data.get("error", {}).get("message", "Bilinmeyen API hatası")


            _create_audit_log(db, None, "WHATSAPP_ERROR", f"API Hatası: {error_message}", order.id)


            logger.error("WhatsApp API hata: %s", error_message)


        except Exception as e:


            _create_audit_log(db, None, "WHATSAPP_ERROR", f"Genel Hata: {str(e)}", order.id)


            logger.error("WhatsApp genel hata: %s", e)





    db.commit()








def list_messages(


    db: Session,


    user: User,


    order_id: Optional[str] = None,


) -> list[dict]:


    """Mesaj geçmişini listele"""


    _assert_whatsapp_permission(user, Permission.WHATSAPP_VIEW)





    query = db.query(WhatsAppMessage).order_by(WhatsAppMessage.sent_at.desc())


    if order_id:


        query = query.filter(WhatsAppMessage.order_id == order_id)


    messages = query.limit(100).all()


    return [_msg_to_dict(m) for m in messages]








def get_summary(db: Session, user: User) -> dict:


    """WhatsApp mesaj özetini getir"""


    _assert_whatsapp_permission(user, Permission.WHATSAPP_VIEW)





    total = db.query(func.count(WhatsAppMessage.id)).scalar() or 0


    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


    today_count = (


        db.query(func.count(WhatsAppMessage.id))


        .filter(WhatsAppMessage.sent_at >= today_start)


        .scalar()


        or 0


    )


    failed = (


        db.query(func.count(WhatsAppMessage.id)).filter(WhatsAppMessage.status == "FAILED").scalar()


        or 0


    )


    recent_msgs = db.query(WhatsAppMessage).order_by(WhatsAppMessage.sent_at.desc()).limit(10).all()





    return {


        "configured": _is_configured(db),


        "total_sent": total,


        "today_sent": today_count,


        "failed": failed,


        "recent": [_msg_to_dict(m) for m in recent_msgs],


    }








def handle_read_webhook(db: Session, webhook_data: dict) -> dict:


    """


    WhatsApp okunma takibi webhook'u.


    Meta WABA'dan gelen okunma bilgisini işler.


    """


    from app.models import Message  # Genel mesaj modeli — webhook'ta kullanılır





    processed = 0


    for entry in webhook_data.get("entry", []):


        for change in entry.get("changes", []):


            for message in change.get("value", {}).get("messages", []):


                if message.get("read") or message.get("status") == "read":


                    message_id = message.get("id")


                    timestamp = message.get("timestamp")





                    db_message = db.query(Message).filter(Message.message_id == message_id).first()


                    if db_message:


                        db_message.is_read = True


                        db_message.read_at = (


                            datetime.fromtimestamp(int(timestamp), timezone.utc)


                            if timestamp


                            else datetime.now(timezone.utc)


                        )


                        _create_audit_log(


                            db,


                            None,


                            "MESSAGE_READ",


                            f"Mesaj okundu: {message_id}",


                        )


                        processed += 1


                        logger.info("Mesaj okundu: %s", message_id)





    db.commit()


    return {"status": "success", "processed": processed}








# ── Yardımcı ──────────────────────────────────────────────








def _msg_to_dict(m: WhatsAppMessage) -> dict:


    """WhatsAppMessage → dict dönüşümü"""


    return {


        "id": m.id,


        "to_phone": m.to_phone,


        "message": m.message,


        "status": m.status,


        "waba_message_id": m.waba_message_id,


        "order_id": m.order_id,


        "order_ts_code": m.order_ts_code,


        "sent_by": m.sent_by_name or "",


        "sent_at": m.sent_at.isoformat() if m.sent_at else "",


        "error": m.error,


    }


