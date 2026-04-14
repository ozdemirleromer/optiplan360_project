"""
OptiPlan 360 - CI/CD Test Pipeline Integration
GitHub Actions workflow ile test otomasyonu

Bu modül:
- PyTest unit testleri
- Playwright E2E testleri  
- TestContainers integration testleri
- Coverage raporlama
- Test sonuçları notification
"""

import pytest
import asyncio
from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime
import json


@dataclass
class TestResult:
    """Test sonuç kaydı"""
    test_id: str
    name: str
    status: str  # 'passed', 'failed', 'skipped', 'error'
    duration_ms: int
    error_message: Optional[str] = None
    screenshot_path: Optional[str] = None
    log_output: Optional[str] = None


@dataclass
class TestSuiteResult:
    """Test suite sonuç özet"""
    suite_name: str
    total: int
    passed: int
    failed: int
    skipped: int
    errors: int
    duration_sec: float
    timestamp: datetime
    results: List[TestResult]


class CICDTestRunner:
    """
    CI/CD pipeline test runner.
    
    GitHub Actions workflow ile entegrasyon:
    1. Unit testleri çalıştır
    2. Coverage threshold kontrolü
    3. E2E testleri çalıştır (staging ortamda)
    4. Test raporu üret
    5. Notification gönder (başarısız olursa)
    """
    
    def __init__(
        self,
        backend_path: str = "./backend",
        frontend_path: str = "./frontend",
        e2e_path: str = "./tests/e2e",
        coverage_threshold: float = 80.0
    ):
        self.backend_path = backend_path
        self.frontend_path = frontend_path
        self.e2e_path = e2e_path
        self.coverage_threshold = coverage_threshold
        self.results: List[TestSuiteResult] = []
        
    async def run_full_pipeline(self) -> Dict[str, any]:
        """
        Tam test pipeline'ını çalıştır.
        
        Returns:
            Pipeline sonuç özeti
        """
        print("🚀 CI/CD Test Pipeline Başlatılıyor...")
        
        results = {
            "timestamp": datetime.utcnow().isoformat(),
            "stages": {}
        }
        
        # Stage 1: Backend Unit Tests
        print("\n📦 Stage 1: Backend Unit Tests")
        backend_result = await self._run_backend_unit_tests()
        results["stages"]["backend_unit"] = backend_result
        
        if backend_result["failed"] > 0:
            results["status"] = "failed"
            results["failed_stage"] = "backend_unit"
            return results
        
        # Stage 2: Coverage Check
        print("\n📊 Stage 2: Coverage Check")
        coverage_result = await self._check_coverage()
        results["stages"]["coverage"] = coverage_result
        
        if not coverage_result["passed"]:
            results["status"] = "failed"
            results["failed_stage"] = "coverage"
            return results
        
        # Stage 3: Bant Mapping Unit Tests
        print("\n🔗 Stage 3: Bant Mapping Validation Tests")
        bant_result = await self._run_bant_mapping_tests()
        results["stages"]["bant_mapping"] = bant_result
        
        if bant_result["failed"] > 0:
            results["status"] = "failed"
            results["failed_stage"] = "bant_mapping"
            return results
        
        # Stage 4: Integration Tests (TestContainers)
        print("\n🐳 Stage 4: Integration Tests")
        integration_result = await self._run_integration_tests()
        results["stages"]["integration"] = integration_result
        
        # Stage 5: E2E Tests (Playwright)
        print("\n🎭 Stage 5: E2E Tests")
        e2e_result = await self._run_e2e_tests()
        results["stages"]["e2e"] = e2e_result
        
        # Final summary
        all_passed = all(
            stage["failed"] == 0 if "failed" in stage else stage["passed"]
            for stage in results["stages"].values()
        )
        
        results["status"] = "passed" if all_passed else "failed"
        
        # Generate report
        await self._generate_report(results)
        
        return results
    
    async def _run_backend_unit_tests(self) -> Dict:
        """Backend PyTest unit testlerini çalıştır"""
        import subprocess
        
        cmd = [
            "pytest",
            f"{self.backend_path}/tests",
            "-v",
            "--tb=short",
            "--json-report",
            "--json-report-file=backend-test-results.json"
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 dakika timeout
            )
            
            # JSON raporunu parse et
            try:
                with open("backend-test-results.json") as f:
                    report = json.load(f)
                
                return {
                    "total": report.get("summary", {}).get("total", 0),
                    "passed": report.get("summary", {}).get("passed", 0),
                    "failed": report.get("summary", {}).get("failed", 0),
                    "skipped": report.get("summary", {}).get("skipped", 0),
                    "duration": report.get("duration", 0),
                    "status": "passed" if report.get("summary", {}).get("failed", 0) == 0 else "failed"
                }
            except:
                # Fallback: stdout parse
                return {
                    "total": 0,
                    "passed": 0 if result.returncode != 0 else 1,
                    "failed": 1 if result.returncode != 0 else 0,
                    "status": "failed" if result.returncode != 0 else "passed",
                    "stdout": result.stdout,
                    "stderr": result.stderr
                }
                
        except subprocess.TimeoutExpired:
            return {
                "status": "timeout",
                "error": "Backend tests timed out (>5min)"
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _check_coverage(self) -> Dict:
        """Coverage threshold kontrolü"""
        import subprocess
        
        cmd = [
            "pytest",
            f"{self.backend_path}/tests",
            "--cov=app",
            "--cov-report=json",
            "--cov-fail-under",
            str(self.coverage_threshold)
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300
            )
            
            # coverage.json parse et
            try:
                with open("coverage.json") as f:
                    coverage_data = json.load(f)
                
                total_coverage = coverage_data.get("totals", {}).get("percent_covered", 0)
                
                return {
                    "passed": result.returncode == 0,
                    "threshold": self.coverage_threshold,
                    "actual": total_coverage,
                    "status": "passed" if total_coverage >= self.coverage_threshold else "failed"
                }
            except:
                return {
                    "passed": result.returncode == 0,
                    "threshold": self.coverage_threshold,
                    "actual": None,
                    "status": "unknown"
                }
                
        except Exception as e:
            return {
                "passed": False,
                "error": str(e)
            }
    
    async def _run_bant_mapping_tests(self) -> Dict:
        """Bant mapping kritik testleri"""
        try:
            from app.services.bant_mapping_validator import BantMappingUnitTest
            
            results = BantMappingUnitTest.run_all_tests()
            
            return {
                "total": results["total"],
                "passed": results["passed"],
                "failed": results["failed"],
                "status": "passed" if results["failed"] == 0 else "failed",
                "details": results["details"]
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _run_integration_tests(self) -> Dict:
        """TestContainers ile integration testleri"""
        # Bu testler gerçek PostgreSQL ve Redis container'ları kullanır
        import subprocess
        
        cmd = [
            "pytest",
            f"{self.backend_path}/tests",
            "-m", "integration",
            "-v"
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600  # 10 dakika
            )
            
            return {
                "status": "passed" if result.returncode == 0 else "failed",
                "returncode": result.returncode,
                "stdout": result.stdout[-2000:],  # Son 2000 karakter
                "stderr": result.stderr[-1000:]
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _run_e2e_tests(self) -> Dict:
        """Playwright E2E testlerini çalıştır"""
        import subprocess
        
        cmd = [
            "npx", "playwright", "test",
            self.e2e_path,
            "--reporter=json",
            "--output=e2e-results"
        ]
        
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600
            )
            
            # JSON raporunu parse et
            try:
                with open("e2e-results/report.json") as f:
                    report = json.load(f)
                
                stats = report.get("stats", {})
                
                return {
                    "total": stats.get("tests", 0),
                    "passed": stats.get("expected", 0),
                    "failed": stats.get("unexpected", 0),
                    "skipped": stats.get("skipped", 0),
                    "status": "passed" if stats.get("unexpected", 0) == 0 else "failed",
                    "duration": stats.get("duration", 0)
                }
            except:
                return {
                    "status": "passed" if result.returncode == 0 else "failed",
                    "returncode": result.returncode,
                    "stdout": result.stdout[-2000:]
                }
                
        except Exception as e:
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def _generate_report(self, results: Dict) -> str:
        """Test raporu üret"""
        report_path = "test-report.html"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>OptiPlan 360 - Test Report</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background: #1a1a2e; color: white; padding: 20px; }}
                .passed {{ color: #4caf50; }}
                .failed {{ color: #f44336; }}
                .stage {{ border: 1px solid #ddd; margin: 10px 0; padding: 15px; }}
                .stage-header {{ font-weight: bold; margin-bottom: 10px; }}
                table {{ width: 100%; border-collapse: collapse; }}
                th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }}
                th {{ background: #f5f5f5; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>OptiPlan 360 - Test Report</h1>
                <p>Timestamp: {results['timestamp']}</p>
                <p>Overall Status: <span class="{results['status']}">{results['status'].upper()}</span></p>
            </div>
            
            <h2>Test Stages</h2>
        """
        
        for stage_name, stage_result in results["stages"].items():
            status = stage_result.get("status", "unknown")
            status_class = "passed" if status == "passed" else "failed"
            
            html_content += f"""
            <div class="stage">
                <div class="stage-header">
                    {stage_name.upper()} 
                    <span class="{status_class}">[{status.upper()}]</span>
                </div>
                <pre>{json.dumps(stage_result, indent=2)}</pre>
            </div>
            """
        
        html_content += """
        </body>
        </html>
        """
        
        with open(report_path, 'w') as f:
            f.write(html_content)
        
        return report_path
    
    def generate_github_actions_workflow(self) -> str:
        """
        GitHub Actions workflow YAML üret.
        
        .github/workflows/test-pipeline.yml olarak kaydedilmeli.
        """
        workflow = """
name: OptiPlan 360 - Test Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  schedule:
    # Her gün gece 2'de çalıştır
    - cron: '0 2 * * *'

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: optiplan_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install backend dependencies
      working-directory: ./backend
      run: |
        pip install -r requirements.txt
        pip install pytest pytest-cov pytest-json-report
    
    - name: Run backend unit tests
      working-directory: ./backend
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/optiplan_test
        REDIS_URL: redis://localhost:6379/0
        PYTHONPATH: .
      run: |
        pytest tests/ -v --tb=short \
          --cov=app --cov-report=xml --cov-report=html \
          --cov-fail-under=80 \
          --json-report --json-report-file=../backend-results.json
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        files: ./backend/coverage.xml
        fail_ci_if_error: true
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      with:
        name: backend-test-results
        path: backend-results.json

  bant-mapping-tests:
    runs-on: ubuntu-latest
    needs: backend-tests
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: pip install -r backend/requirements.txt
    
    - name: Run Bant Mapping Unit Tests
      working-directory: ./backend
      env:
        PYTHONPATH: .
      run: |
        python -c "
from app.services.bant_mapping_validator import BantMappingUnitTest
import json
results = BantMappingUnitTest.run_all_tests()
print(json.dumps(results, indent=2))
if results['failed'] > 0:
    exit(1)
"

  integration-tests:
    runs-on: ubuntu-latest
    needs: backend-tests
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: optiplan_test
        ports:
          - 5432:5432
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      working-directory: ./backend
      run: |
        pip install -r requirements.txt
        pip install pytest pytest-testcontainers
    
    - name: Run integration tests
      working-directory: ./backend
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/optiplan_test
        PYTHONPATH: .
      run: |
        pytest tests/ -m integration -v --tb=short

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [backend-tests, bant-mapping-tests]
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
    
    - name: Install dependencies
      run: |
        cd frontend && npm ci
        cd ../tests/e2e && npm ci
    
    - name: Install Playwright
      run: |
        cd tests/e2e
        npx playwright install --with-deps chromium
    
    - name: Start backend (background)
      working-directory: ./backend
      env:
        DATABASE_URL: sqlite:///./test.db
        PYTHONPATH: .
      run: |
        python -c "from app.main import app; import uvicorn; uvicorn.run(app, host='127.0.0.1', port=8000)" &
        sleep 5
    
    - name: Start frontend (background)
      working-directory: ./frontend
      run: |
        npm run dev &
        sleep 10
    
    - name: Run E2E tests
      working-directory: ./tests/e2e
      run: |
        npx playwright test --project=chromium
    
    - name: Upload E2E results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: e2e-results
        path: |
          tests/e2e/playwright-report/
          tests/e2e/test-results/

  test-summary:
    runs-on: ubuntu-latest
    needs: [backend-tests, bant-mapping-tests, integration-tests, e2e-tests]
    if: always()
    
    steps:
    - name: Download all artifacts
      uses: actions/download-artifact@v3
    
    - name: Generate summary
      run: |
        echo "## Test Results Summary" >> $GITHUB_STEP_SUMMARY
        echo "" >> $GITHUB_STEP_SUMMARY
        
        # Backend results
        if [ -f backend-test-results/results.json ]; then
          echo "### Backend Tests" >> $GITHUB_STEP_SUMMARY
          cat backend-test-results/results.json | jq -r '. | "- Total: \\(.total), Passed: \\(.passed), Failed: \\(.failed)"' >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
        fi
        
        # E2E results
        if [ -f e2e-results/results.json ]; then
          echo "### E2E Tests" >> $GITHUB_STEP_SUMMARY
          cat e2e-results/results.json | jq -r '. | "- Total: \\(.total), Passed: \\(.passed), Failed: \\(.failed)"' >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
        fi
        
        # Final status
        if [ "${{ needs.backend-tests.result }}" == "success" ] && \\
           [ "${{ needs.bant-mapping-tests.result }}" == "success" ] && \\
           [ "${{ needs.integration-tests.result }}" == "success" ] && \\
           [ "${{ needs.e2e-tests.result }}" == "success" ]; then
          echo "✅ **All tests passed**" >> $GITHUB_STEP_SUMMARY
        else
          echo "❌ **Some tests failed**" >> $GITHUB_STEP_SUMMARY
          exit 1
        fi

  notify:
    runs-on: ubuntu-latest
    needs: [test-summary]
    if: failure() && github.ref == 'refs/heads/main'
    
    steps:
    - name: Notify Slack
      uses: slackapi/slack-github-action@v1.24.0
      with:
        payload: |
          {
            "text": "❌ OptiPlan 360 Test Pipeline Failed",
            "blocks": [
              {
                "type": "header",
                "text": {
                  "type": "plain_text",
                  "text": "🚨 Test Pipeline Failed"
                }
              },
              {
                "type": "section",
                "fields": [
                  {
                    "type": "mrkdwn",
                    "text": "*Branch:*\\n${{ github.ref }}"
                  },
                  {
                    "type": "mrkdwn",
                    "text": "*Commit:*\\n${{ github.sha }}"
                  }
                ]
              },
              {
                "type": "actions",
                "elements": [
                  {
                    "type": "button",
                    "text": {
                      "type": "plain_text",
                      "text": "View Details"
                    },
                    "url": "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
                  }
                ]
              }
            ]
          }
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
"""
        return workflow.strip()


# CLI kullanımı için
if __name__ == "__main__":
    import asyncio
    
    runner = CICDTestRunner()
    
    # GitHub Actions workflow üret
    workflow_yaml = runner.generate_github_actions_workflow()
    
    with open("test-pipeline-workflow.yml", "w") as f:
        f.write(workflow_yaml)
    
    print("✅ GitHub Actions workflow üretildi: test-pipeline-workflow.yml")
    print("\nBu dosyayı .github/workflows/test-pipeline.yml olarak kaydedin.")
    
    # Lokal test çalıştırma (opsiyonel)
    # asyncio.run(runner.run_full_pipeline())
