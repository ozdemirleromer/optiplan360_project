"""
Biesse OptiPlanning Entegrasyon Servisi
OptiPlan 360 ile Biesse OptiPlanning sistemleri arasÄ±ndaki veri akÄ±ÅŸÄ±nÄ± yÃ¶netir
"""

import os
import json
import xml.etree.ElementTree as ET
import subprocess
import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Any
from pathlib import Path
import tempfile
from uuid import uuid4

from app.database import SessionLocal
from app.models import StockCard, StockMovement
from app.exceptions import BusinessRuleError, ValidationError
from .optiplan_csv_otomasyon import CSV_ROW1, CSV_ROW2, optiplan_csv_otomasyon

logger = logging.getLogger(__name__)

class BiesseIntegrationService:
    """Biesse OptiPlanning entegrasyon servisi"""
    
    def __init__(self, optiplanning_path: str = "C:/Biesse/OptiPlanning"):
        self.optiplanning_path = Path(optiplanning_path)
        self.xml_job_path = self.optiplanning_path / "Tmp" / "Sol"
        self.xml_mat_path = self.optiplanning_path / "XmlMat"
        self.job_path = self.optiplanning_path / "Job"
        self.system_path = self.optiplanning_path / "System"
        
        # KlasÃ¶rleri kontrol et
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Gerekli klasÃ¶rleri oluÅŸtur"""
        for path in [self.xml_job_path, self.xml_mat_path, self.job_path]:
            path.mkdir(parents=True, exist_ok=True)
    
    def export_materials_to_biesse(self, material_ids: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        OptiPlan 360 malzeme stoklarÄ±nÄ± Biesse formatÄ±nda export eder
        """
        try:
            db = SessionLocal()
            
            # Malzemeleri getir
            query = db.query(StockCard).filter(StockCard.is_active == True)
            if material_ids:
                query = query.filter(StockCard.id.in_(material_ids))
            
            materials = query.all()
            
            # XML yapÄ±sÄ± oluÅŸtur
            root = ET.Element("Inventry")
            materials_elem = ET.SubElement(root, "Material")
            
            for material in materials:
                # Stok miktarÄ±nÄ± hesapla
                total_stock = self._calculate_material_stock(db, material.stock_code)
                
                if total_stock > 0:
                    # Board elementi (tam levhalar)
                    board = ET.SubElement(materials_elem, "Board")
                    board.set("Code", material.stock_code or f"MAT{material.id}")
                    board.set("L", str(material.length or 2800))  # mm
                    board.set("W", str(material.width or 2070))   # mm
                    board.set("Thickness", str(material.thickness or 18))  # mm
                    board.set("Qty", str(int(total_stock)))
                    
                    # Drop elementi (artÄ±k malzemeler)
                    drops = self._get_material_drops(db, material.id)
                    for drop in drops:
                        drop_elem = ET.SubElement(materials_elem, "Drop")
                        drop_elem.set("Code", f"DROP{material.id}_{drop['id']}")
                        drop_elem.set("L", str(drop['length']))
                        drop_elem.set("W", str(drop['width']))
                        drop_elem.set("Thickness", str(material.thickness or 18))
                        drop_elem.set("Qty", str(drop['quantity']))
            
            # XML dosyasÄ±nÄ± kaydet
            xml_content = ET.tostring(root, encoding='utf-8', xml_declaration=True)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            xml_file = self.xml_mat_path / f"optiplan_import_{timestamp}.xml"
            
            with open(xml_file, 'wb') as f:
                f.write(xml_content)
            
            db.close()
            
            return {
                "success": True,
                "message": f"{len(materials)} malzeme Biesse formatÄ±nda export edildi",
                "file_path": str(xml_file),
                "material_count": len(materials),
                "timestamp": timestamp
            }
            
        except Exception as e:
            logger.error(f"Biesse export hatasÄ±: {str(e)}")
            raise BusinessRuleError(f"Malzeme export edilemedi: {str(e)}")
    
    def import_cutting_plan_from_biesse(self, opjx_file_path: str) -> Dict[str, Any]:
        """
        Biesse kesim planÄ±nÄ± OptiPlan 360'a import eder
        """
        try:
            if not os.path.exists(opjx_file_path):
                raise ValidationError("OPJX dosyasÄ± bulunamadÄ±")
            
            # OPJX dosyasÄ±nÄ± parse et
            cutting_plan = self._parse_opjx_file(opjx_file_path)
            
            # VeritabanÄ±na kaydet
            db = SessionLocal()
            
            # Ãœretim kayÄ±tlarÄ± oluÅŸtur
            production_records = []
            for item in cutting_plan.get("items", []):
                record = {
                    "material_code": item.get("material_code"),
                    "quantity": item.get("quantity", 0),
                    "cut_length": item.get("cut_length"),
                    "cut_width": item.get("cut_width"),
                    "waste_percentage": item.get("waste_percentage", 0),
                    "production_date": datetime.now(),
                    "status": "planned"
                }
                production_records.append(record)
            
            # Stok hareketlerini gÃ¼ncelle
            for record in production_records:
                self._create_stock_movement(db, record)
            
            db.commit()
            db.close()
            
            return {
                "success": True,
                "message": f"Kesim planÄ± import edildi: {len(production_records)} kayÄ±t",
                "items_processed": len(production_records),
                "plan_details": cutting_plan
            }
            
        except Exception as e:
            logger.error(f"Biesse import hatasÄ±: {str(e)}")
            raise BusinessRuleError(f"Kesim planÄ± import edilemedi: {str(e)}")
    
    def create_cutting_job(self, order_items: List[Dict[str, Any]], import_format: str = "basic") -> Dict[str, Any]:
        """
        Siparis kalemlerini OPF uyumlu 12 kolon CSV'ye donusturur ve
        OptiPlanning'i -silent batch execution ile tetikler.

        import_format argumani geriye donuk uyumluluk icin korunur.
        """
        try:
            job_name = f"OPTIPLAN_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            opjx_file = self.job_path / f"{job_name}.opjx"

            job_data = {
                "job_name": job_name,
                "created_date": datetime.now().isoformat(),
                "items": order_items,
                "import_format": import_format,
            }
            opjx_file.write_text(self._generate_opjx_content(job_data), encoding="utf-8")

            mapped_parts = []

            for item in order_items:
                mapped_parts.append(
                    {
                        "malzeme": item.get("material") or item.get("material_code") or "18MM 210*280",
                        "boy": item.get("length") or item.get("boy") or item.get("L") or 0,
                        "en": item.get("width") or item.get("en") or item.get("W") or 0,
                        "adet": item.get("quantity") or item.get("adet") or item.get("Qty") or 1,
                        "suyolu": item.get("grain") or item.get("grain_code") or 0,
                        "aciklama": item.get("description1") or item.get("description") or "",
                        "ust_bant": item.get("edge_upper_material") or item.get("ust_bant") or "",
                        "alt_bant": item.get("edge_lower_material") or item.get("alt_bant") or "",
                        "sol_bant": item.get("edge_left_material") or item.get("sol_bant") or "",
                        "sag_bant": item.get("edge_right_material") or item.get("sag_bant") or "",
                        "kod": item.get("part_code") or item.get("code") or "",
                        "ek_aciklama": item.get("description2") or "",
                    }
                )

            csv_file = optiplan_csv_otomasyon(
                siparis_no=job_name,
                parca_listesi=mapped_parts,
                tetikle_optiplan=True,
                baslik_satirlari=True,
            )

            return {
                "success": True,
                "message": "Kesim isi OPF kurali ile olusturuldu ve -silent modda calistirildi",
                "job_file": str(opjx_file),
                "csv_file": str(csv_file),
                "job_name": job_name,
                "import_format": import_format,
            }
        except Exception as e:
            logger.error(f"Kesim isi olusturma hatasi: {str(e)}")
            raise BusinessRuleError(f"Kesim isi olusturulamadi: {str(e)}")

    def get_biesse_status(self) -> Dict[str, Any]:
        """
        Biesse OptiPlanning sistem durumunu kontrol eder
        """
        try:
            status = {
                "optiplanning_installed": self.optiplanning_path.exists(),
                "directories_exist": all([
                    self.xml_job_path.exists(),
                    self.xml_mat_path.exists(),
                    self.job_path.exists(),
                    self.system_path.exists()
                ]),
                "executable_available": (self.system_path / "OptiPlan.exe").exists(),
                "recent_jobs": self._get_recent_jobs(),
                "material_files": self._get_material_files()
            }
            
            return {
                "success": True,
                "status": status
            }
            
        except Exception as e:
            logger.error(f"Biesse durum kontrolÃ¼ hatasÄ±: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def sync_materials_bidirectional(self) -> Dict[str, Any]:
        """
        Ä°ki yÃ¶nlÃ¼ malzeme senkronizasyonu
        """
        try:
            # OptiPlan 360 â†’ Biesse
            export_result = self.export_materials_to_biesse()
            
            # Biesse â†’ OptiPlan 360 (varsa kesim planlarÄ±)
            import_results = []
            for opjx_file in self._get_pending_opjx_files():
                try:
                    result = self.import_cutting_plan_from_biesse(opjx_file)
                    import_results.append(result)
                except Exception as e:
                    logger.warning(f"OPJX import hatasÄ±: {opjx_file} - {str(e)}")
            
            return {
                "success": True,
                "export_result": export_result,
                "import_results": import_results,
                "sync_timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Ä°ki yÃ¶nlÃ¼ senkronizasyon hatasÄ±: {str(e)}")
            raise BusinessRuleError(f"Senkronizasyon baÅŸarÄ±sÄ±z: {str(e)}")
    
    # YardÄ±mcÄ± metodlar
    def _calculate_material_stock(self, db, stock_code: str) -> float:
        """Malzeme stok miktarÄ±nÄ± hesaplar (stock_code bazli)."""
        try:
            movements = db.query(StockMovement).filter(
                StockMovement.stock_code == stock_code
            ).with_entities(StockMovement.movement_type, StockMovement.quantity).all()

            balance = 0.0
            for movement_type, quantity in movements:
                q = float(quantity or 0)
                mtype = str(movement_type or "").upper()
                if mtype in {"OUT", "EXIT"}:
                    balance -= q
                else:
                    balance += q
            return max(balance, 0.0)
        except Exception:
            return 0.0
    
    def _get_material_drops(self, db, material_id: int) -> List[Dict[str, Any]]:
        """Malzeme artÄ±klarÄ±nÄ± getir"""
        # Bu metot stok artÄ±klarÄ±nÄ± hesaplar
        return []  # Åimdilik boÅŸ
    
    def _parse_opjx_file(self, file_path: str) -> Dict[str, Any]:
        """OPJX dosyasÄ±nÄ± parse eder"""
        # Basit implementasyon - gerÃ§ek OPJX formatÄ±na gÃ¶re gÃ¼ncellenmeli
        return {
            "job_name": os.path.basename(file_path),
            "items": [
                {
                    "material_code": "MAT001",
                    "quantity": 10,
                    "cut_length": 1200,
                    "cut_width": 800,
                    "waste_percentage": 5.2
                }
            ]
        }
    
    def _generate_opjx_content(self, job_data: Dict[str, Any]) -> str:
        """OPJX dosya iÃ§eriÄŸi oluÅŸturur"""
        # Basit implementasyon - gerÃ§ek OPJX formatÄ±na gÃ¶re gÃ¼ncellenmeli
        content = f"""
[JOB]
Name={job_data['job_name']}
Date={job_data['created_date']}

[ITEMS]
Count={len(job_data['items'])}
"""
        
        for i, item in enumerate(job_data['items'], 1):
            content += f"""
Item{i}={item.get('material_code', '')}
Quantity{i}={item.get('quantity', 0)}
Length{i}={item.get('length', 0)}
Width{i}={item.get('width', 0)}
"""
        
        return content
    
    def _run_optiplanning(self, opjx_file: Path) -> bool:
        """OptiPlanning'i Ã§alÄ±ÅŸtÄ±rÄ±r"""
        try:
            exe_path = self.system_path / "OptiPlan.exe"
            if not exe_path.exists():
                return False
            
            # OptiPlanning'i subprocess ile Ã§alÄ±ÅŸtÄ±r
            result = subprocess.run([
                str(exe_path),
                "-f", str(opjx_file),
                "-a"  # Otomatik Ã§alÄ±ÅŸtÄ±r
            ], capture_output=True, text=True, timeout=300)
            
            return result.returncode == 0
            
        except Exception as e:
            logger.error(f"OptiPlanning Ã§alÄ±ÅŸtÄ±rma hatasÄ±: {str(e)}")
            return False
    
    def _create_stock_movement(self, db, record: Dict[str, Any]):
        """Stok hareketi oluÅŸturur"""
        try:
            stock_code = str(record.get("material_code") or "").strip()
            if not stock_code:
                return

            qty = float(record.get("quantity") or 0)
            if qty <= 0:
                return

            movement = StockMovement(
                id=str(uuid4()),
                stock_code=stock_code,
                movement_type="EXIT",
                quantity=qty,
                unit_price=None,
                total_amount=None,
                reference_document="BIESSE_PLAN",
                reference_id=str(record.get("job_name") or ""),
                description=f"Biesse kesim plani tuketimi ({record.get('cut_length')}x{record.get('cut_width')})",
                movement_date=datetime.now(timezone.utc),
                created_by=None,
                updated_by=None,
            )
            db.add(movement)
        except Exception as exc:
            logger.warning("Stok hareketi olusturulamadi: %s", exc)
    
    def _get_recent_jobs(self) -> List[str]:
        """Son iÅŸ dosyalarÄ±nÄ± listeler"""
        try:
            job_files = list(self.job_path.glob("*.opjx"))
            job_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            return [f.name for f in job_files[:10]]
        except:
            return []
    
    def _get_material_files(self) -> List[str]:
        """Malzeme dosyalarÄ±nÄ± listeler"""
        try:
            mat_files = list(self.xml_mat_path.glob("*.xml"))
            mat_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
            return [f.name for f in mat_files[:10]]
        except:
            return []
    
    def _generate_csv_content(self, order_items: List[Dict[str, Any]], import_format: str) -> str:
        """
        OPF free-format standardina uygun 12 kolon CSV metni uretir.

        Not: Bu metod geriye donuk yardimci amacla tutulur; asıl calisma
        `optiplan_csv_otomasyon` ile dogrudan dosyaya yazilip -silent
        batch import seklinde yapilir.
        """
        lines = [",".join(CSV_ROW1), ",".join(CSV_ROW2)]

        for item in order_items:
            row = [
                item.get("material") or item.get("material_code") or "",
                item.get("length") or item.get("boy") or item.get("L") or "",
                item.get("width") or item.get("en") or item.get("W") or "",
                item.get("quantity") or item.get("adet") or item.get("Qty") or 1,
                item.get("grain") or item.get("grain_code") or 0,
                item.get("description1") or item.get("description") or "",
                item.get("edge_upper_material") or item.get("ust_bant") or "",
                item.get("edge_lower_material") or item.get("alt_bant") or "",
                item.get("edge_left_material") or item.get("sol_bant") or "",
                item.get("edge_right_material") or item.get("sag_bant") or "",
                item.get("part_code") or item.get("code") or "",
                item.get("description2") or "",
            ]

            normalized = []
            for value in row:
                text = str(value if value is not None else "")
                text = text.replace("\r", " ").replace("\n", " ").replace("\t", " ").replace(",", " ").strip()
                text = text.encode("ascii", "ignore").decode("ascii")
                normalized.append(text)

            lines.append(",".join(normalized))

        return "\n".join(lines)

    def _get_pending_opjx_files(self) -> List[str]:
        """Ä°ÅŸlenmeyi bekleyen OPJX dosyalarÄ±nÄ± bulur"""
        try:
            # Basit implementasyon - gerÃ§ek mantÄ±ÄŸa gÃ¶re gÃ¼ncellenmeli
            return []
        except:
            return []

    def cleanup_old_files(self, days_old: int = 30) -> Dict[str, Any]:
        """
        Biesse entegrasyon dizinlerindeki eski dosyalari temizler.
        Hedef dosyalar: XmlJob/*.xml, XmlMat/*.xml, Job/*.opjx, Job/*.csv
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=max(days_old, 0))
        cleaned = 0
        scanned = 0
        errors: List[str] = []

        targets = [
            (self.xml_job_path, "*.xml"),
            (self.xml_mat_path, "*.xml"),
            (self.job_path, "*.opjx"),
            (self.job_path, "*.csv"),
        ]

        for folder, pattern in targets:
            try:
                files = list(folder.glob(pattern))
            except Exception as exc:
                errors.append(f"{folder}: {exc}")
                continue

            for file_path in files:
                scanned += 1
                try:
                    modified = datetime.fromtimestamp(file_path.stat().st_mtime, tz=timezone.utc)
                    if modified < cutoff:
                        file_path.unlink(missing_ok=True)
                        cleaned += 1
                except Exception as exc:
                    errors.append(f"{file_path}: {exc}")

        return {
            "success": len(errors) == 0,
            "scanned_files": scanned,
            "cleaned_files": cleaned,
            "days_old": days_old,
            "errors": errors,
        }

# Singleton instance
biesse_service = BiesseIntegrationService()
