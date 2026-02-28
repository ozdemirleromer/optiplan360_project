@echo off
setlocal
echo Starting OptiPlan 360 Production Server...
cd /d "%~dp0backend"

if not exist ".venv\Scripts\python.exe" (
    echo backend\.venv not found. Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo ERROR: Failed to create backend virtual environment.
        exit /b 1
    )
)

echo Installing backend dependencies...
".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install backend dependencies.
    exit /b 1
)

echo Server running at http://localhost:8080/
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8080
endlocal
