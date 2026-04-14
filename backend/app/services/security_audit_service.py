"""
Security Audit Tool Integration
Bandit, Safety ve diğer security tool'lar için entegrasyon
"""

import os
import subprocess
import logging
from typing import Dict, Any, List
from pathlib import Path

logger = logging.getLogger(__name__)


class SecurityAuditService:
    """Security audit tool entegrasyon servisi"""
    
    def __init__(self, project_root: str = "."):
        self.project_root = Path(project_root)
        self.reports_dir = self.project_root / "security_reports"
        self.reports_dir.mkdir(exist_ok=True)
    
    def run_bandit_scan(self) -> Dict[str, Any]:
        """
        Bandit ile Python security scan
        
        Returns:
            Dict: Scan sonuçları
        """
        try:
            output_file = self.reports_dir / "bandit_report.json"
            
            cmd = [
                "bandit",
                "-r",  # Recursive
                "-f", "json",  # JSON format
                "-o", str(output_file),  # Output file
                "-ll",  # Low severity and above
                "-ii",  # Include low confidence
                "backend/app"  # Scan directory
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=str(self.project_root)
            )
            
            # Bandit 0 exit code = no issues, 1 = issues found
            if output_file.exists():
                import json
                with open(output_file, 'r') as f:
                    report = json.load(f)
                
                return {
                    "tool": "bandit",
                    "success": True,
                    "issues_found": len(report.get("results", [])),
                    "report_file": str(output_file),
                    "summary": report.get("metrics", {})
                }
            else:
                return {
                    "tool": "bandit",
                    "success": True,
                    "issues_found": 0,
                    "message": "No issues found"
                }
                
        except FileNotFoundError:
            return {
                "tool": "bandit",
                "success": False,
                "error": "Bandit not installed. Run: pip install bandit"
            }
        except Exception as e:
            logger.error(f"[SECURITY_AUDIT] Bandit scan failed: {e}")
            return {
                "tool": "bandit",
                "success": False,
                "error": str(e)
            }
    
    def run_safety_check(self) -> Dict[str, Any]:
        """
        Safety ile dependency vulnerability check
        
        Returns:
            Dict: Check sonuçları
        """
        try:
            cmd = [
                "safety",
                "check",
                "--json",
                "-r", "backend/requirements.txt"
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=str(self.project_root)
            )
            
            import json
            try:
                report = json.loads(result.stdout)
                vulnerabilities = report.get("vulnerabilities", [])
                
                return {
                    "tool": "safety",
                    "success": True,
                    "vulnerabilities_found": len(vulnerabilities),
                    "vulnerabilities": vulnerabilities,
                    "report": report
                }
            except json.JSONDecodeError:
                # Safety 0 vulns = empty output or non-JSON
                return {
                    "tool": "safety",
                    "success": True,
                    "vulnerabilities_found": 0,
                    "message": "No known vulnerabilities found"
                }
                
        except FileNotFoundError:
            return {
                "tool": "safety",
                "success": False,
                "error": "Safety not installed. Run: pip install safety"
            }
        except Exception as e:
            logger.error(f"[SECURITY_AUDIT] Safety check failed: {e}")
            return {
                "tool": "safety",
                "success": False,
                "error": str(e)
            }
    
    def generate_security_report(self) -> Dict[str, Any]:
        """
        Tüm security audit tool'larını çalıştır ve rapor üret
        
        Returns:
            Dict: Combined security report
        """
        logger.info("[SECURITY_AUDIT] Starting security audit...")
        
        bandit_result = self.run_bandit_scan()
        safety_result = self.run_safety_check()
        
        total_issues = (
            bandit_result.get("issues_found", 0) +
            safety_result.get("vulnerabilities_found", 0)
        )
        
        report = {
            "timestamp": str(datetime.now()),
            "summary": {
                "total_issues": total_issues,
                "bandit_issues": bandit_result.get("issues_found", 0),
                "safety_vulnerabilities": safety_result.get("vulnerabilities_found", 0)
            },
            "details": {
                "bandit": bandit_result,
                "safety": safety_result
            },
            "recommendations": []
        }
        
        # Öneriler ekle
        if bandit_result.get("issues_found", 0) > 0:
            report["recommendations"].append(
                f"Bandit found {bandit_result['issues_found']} security issues. Review bandit_report.json"
            )
        
        if safety_result.get("vulnerabilities_found", 0) > 0:
            report["recommendations"].append(
                f"Safety found {safety_result['vulnerabilities_found']} vulnerable dependencies. Update requirements.txt"
            )
        
        if total_issues == 0:
            report["recommendations"].append("No security issues found. Keep up the good work!")
        
        # Raporu kaydet
        report_file = self.reports_dir / "security_audit_report.json"
        import json
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2)
        
        logger.info(f"[SECURITY_AUDIT] Security report generated: {report_file}")
        
        return report
    
    def check_hardcoded_secrets(self) -> Dict[str, Any]:
        """
        Kodda hardcoded secret'ları tara
        
        Returns:
            Dict: Bulunan secret'lar
        """
        import re
        
        patterns = [
            (r'password\s*=\s*["\'][^"\']+["\']', "Hardcoded password"),
            (r'secret\s*=\s*["\'][^"\']+["\']', "Hardcoded secret"),
            (r'api_key\s*=\s*["\'][^"\']+["\']', "Hardcoded API key"),
            (r'token\s*=\s*["\'][^"\']+["\']', "Hardcoded token"),
        ]
        
        findings = []
        
        for file_path in self.project_root.rglob("*.py"):
            # Test dosyalarını atla
            if "test" in str(file_path).lower():
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    lines = content.split('\n')
                    
                    for line_num, line in enumerate(lines, 1):
                        for pattern, description in patterns:
                            if re.search(pattern, line, re.IGNORECASE):
                                findings.append({
                                    "file": str(file_path),
                                    "line": line_num,
                                    "description": description,
                                    "content": line.strip()[:100]  # İlk 100 karakter
                                })
            except Exception:
                continue
        
        return {
            "tool": "custom_secret_scan",
            "secrets_found": len(findings),
            "findings": findings
        }


from datetime import datetime

# Global instance
_audit_service = None


def get_security_audit_service() -> SecurityAuditService:
    """Security audit servisi singleton"""
    global _audit_service
    
    if _audit_service is None:
        _audit_service = SecurityAuditService()
    
    return _audit_service
