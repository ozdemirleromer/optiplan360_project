"""
OptiPlan 360 - Email Service
SMTP entegrasyonu ve email şablon yönetimi
"""
import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from typing import List, Optional, Dict
from jinja2 import Template

# Email şablonları
EMAIL_TEMPLATES = {
    "order_created": """
    <h2>Yeni Sipariş Oluşturuldu</h2>
    <p>Sayın {{ customer_name }},</p>
    <p>Siparişiniz başarıyla oluşturulmuştur.</p>
    <ul>
        <li><strong>Sipariş No:</strong> {{ order_id }}</li>
        <li><strong>Tarih:</strong> {{ order_date }}</li>
        <li><strong>Durum:</strong> {{ order_status }}</li>
    </ul>
    <p>Detaylar için: <a href="{{ app_url }}/orders/{{ order_id }}">Siparişi Görüntüle</a></p>
    """,
    
    "order_status_changed": """
    <h2>Sipariş Durumu Güncellendi</h2>
    <p>Sayın {{ customer_name }},</p>
    <p>Siparişinizin durumu değişti.</p>
    <ul>
        <li><strong>Sipariş No:</strong> {{ order_id }}</li>
        <li><strong>Eski Durum:</strong> {{ old_status }}</li>
        <li><strong>Yeni Durum:</strong> {{ new_status }}</li>
    </ul>
    <p>Detaylar için: <a href="{{ app_url }}/orders/{{ order_id }}">Siparişi Görüntüle</a></p>
    """,
    
    "reminder_payment": """
    <h2>Ödeme Hatırlatması</h2>
    <p>Sayın {{ customer_name }},</p>
    <p>Aşağıdaki faturanızın ödemesi yaklaşmaktadır:</p>
    <ul>
        <li><strong>Fatura No:</strong> {{ invoice_id }}</li>
        <li><strong>Tutar:</strong> {{ amount }} {{ currency }}</li>
        <li><strong>Son Ödeme:</strong> {{ due_date }}</li>
    </ul>
    <p>Lütfen zamanında ödeme yapınız.</p>
    """,
    
    "welcome": """
    <h2>Hoş Geldiniz!</h2>
    <p>Sayın {{ username }},</p>
    <p>OptiPlan 360'a kaydolduğunuz için teşekkür ederiz.</p>
    <p>Hesabınız aktif edilmiştir. Giriş yapmak için:</p>
    <p><a href="{{ app_url }}/login" style="padding: 10px 20px; background: #3B8BF5; color: white; text-decoration: none; border-radius: 4px;">Giriş Yap</a></p>
    """,
    
    "forgot_password": """
    <h2>Şifre Sıfırlama İsteği</h2>
    <p>Sayın {{ username }},</p>
    <p>Hesabınız için şifre sıfırlama talebinde bulundunuz.</p>
    <p>Yeni şifrenizi belirlemek için aşağıdaki bağlantıya tıklayın:</p>
    <br>
    <p><a href="{{ reset_link }}" style="padding: 10px 20px; background: #3B8BF5; color: white; text-decoration: none; border-radius: 4px;">Şifremi Sıfırla</a></p>
    <br>
    <p>Eğer bu talebi siz yapmadıysanız, bu e-postayı dikkate almayınız.</p>
    <p><em>Bu bağlantı 1 saat boyunca geçerlidir.</em></p>
    """,

    "ticket_replied": """
    <h2>Destek Talebiniz Yanıtlandı</h2>
    <p>Sayın {{ username }},</p>
    <p><strong>{{ subject }}</strong> konulu destek talebinize operatörlerimiz tarafından yeni bir yanıt eklendi.</p>
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p style="margin: 0; white-space: pre-wrap;">{{ reply_message }}</p>
    </div>
    <p>Yanıt vermek veya talebinizi detaylı incelemek için müşteri portalınıza giriş yapabilirsiniz:</p>
    <br>
    <p><a href="{{ app_url }}/support" style="padding: 10px 20px; background: #3B8BF5; color: white; text-decoration: none; border-radius: 4px;">Talebi Görüntüle</a></p>
    """
}


class EmailService:
    """Email gönderim servisi"""
    
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.smtp_from = os.getenv("SMTP_FROM", "noreply@optiplan360.com")
        self.app_url = os.getenv("APP_URL", "https://optiplan360.com")
        
    def is_configured(self) -> bool:
        """SMTP ayarları yapılandırılmış mı?"""
        return all([self.smtp_host, self.smtp_user, self.smtp_password])
    
    def render_template(self, template_name: str, context: Dict) -> str:
        """Email şablonunu render et"""
        template_str = EMAIL_TEMPLATES.get(template_name, "")
        if not template_str:
            return ""
        
        template = Template(template_str)
        return template.render(**context, app_url=self.app_url)
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        attachments: Optional[List[Dict]] = None
    ) -> bool:
        """Email gönder"""
        if not self.is_configured():
            print("SMTP not configured")
            return False
        
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = self.smtp_from
            msg['To'] = to_email
            
            # HTML content
            html_part = MIMEText(html_content, 'html', 'utf-8')
            msg.attach(html_part)
            
            # Attachments
            if attachments:
                for att in attachments:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(att['content'])
                    encoders.encode_base64(part)
                    part.add_header(
                        'Content-Disposition',
                        f'attachment; filename= {att["filename"]}'
                    )
                    msg.attach(part)
            
            # Send
            context = ssl.create_default_context()
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls(context=context)
                server.login(self.smtp_user, self.smtp_password)
                server.send_message(msg)
            
            return True
            
        except Exception as e:
            print(f"Email send failed: {e}")
            return False
    
    def send_order_created(self, to_email: str, customer_name: str, order_id: str, 
                         order_date: str, order_status: str) -> bool:
        """Yeni sipariş emaili gönder"""
        html = self.render_template("order_created", {
            "customer_name": customer_name,
            "order_id": order_id,
            "order_date": order_date,
            "order_status": order_status,
        })
        return self.send_email(to_email, f"Sipariş Oluşturuldu - #{order_id}", html)
    
    def send_order_status_changed(self, to_email: str, customer_name: str, order_id: str,
                                 old_status: str, new_status: str) -> bool:
        """Sipariş durum değişikliği emaili gönder"""
        html = self.render_template("order_status_changed", {
            "customer_name": customer_name,
            "order_id": order_id,
            "old_status": old_status,
            "new_status": new_status,
        })
        return self.send_email(to_email, f"Sipariş Durumu Güncellendi - #{order_id}", html)
    
    def send_payment_reminder(self, to_email: str, customer_name: str, invoice_id: str,
                             amount: float, currency: str, due_date: str) -> bool:
        """Ödeme hatırlatması gönder"""
        html = self.render_template("reminder_payment", {
            "customer_name": customer_name,
            "invoice_id": invoice_id,
            "amount": amount,
            "currency": currency,
            "due_date": due_date,
        })
        return self.send_email(to_email, f"Ödeme Hatırlatması - Fatura #{invoice_id}", html)
    
    def send_welcome(self, to_email: str, username: str) -> bool:
        """Hoş geldin emaili gönder"""
        html = self.render_template("welcome", {
            "username": username,
        })
        return self.send_email(to_email, "OptiPlan 360'a Hoş Geldiniz!", html)

    def send_password_reset(self, to_email: str, username: str, reset_link: str) -> bool:
        """Şifre sıfırlama emaili gönder"""
        html = self.render_template("forgot_password", {
            "username": username,
            "reset_link": reset_link
        })
        return self.send_email(to_email, "OptiPlan360 - Şifre Sıfırlama İstediğiniz", html)
        
    def send_ticket_reply(self, to_email: str, username: str, subject: str, reply_message: str) -> bool:
        """Müşteriye destek biletinin yanıtlandığını bildir"""
        html = self.render_template("ticket_replied", {
            "username": username,
            "subject": subject,
            "reply_message": reply_message
        })
        return self.send_email(to_email, f"Destek Talebiniz Yanıtlandı: {subject}", html)


# Singleton instance
email_service = EmailService()
