Write-Host "Kurulum başlıyor..."

# Klasörleri oluştur
New-Item -ItemType Directory -Force -Path backend, frontend, .devcontainer, .github/workflows, .git/hooks | Out-Null

# Backend requirements.txt
$backendReq = @"
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.34
psycopg2-binary==2.9.9
alembic==1.13.2
python-jose[cryptography]
slowapi
jinja2
email-validator
openpyxl
pandas
python-multipart
pytz
pyodbc
google-generativeai
apscheduler
pytest==8.3.2
httpx==0.27.0
flake8==7.1.1
black==24.8.0
bandit==1.7.9
"@
$backendReq | Out-File -FilePath backend\requirements.txt -Encoding utf8 -Force

# Backend Dockerfile
$backendDocker = @"
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends unixodbc && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
"@
$backendDocker | Out-File -FilePath backend\Dockerfile -Encoding utf8 -Force

# Frontend package.json
$frontendPkg = @'
{
  "name": "frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "test": "jest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "eslint": "^9.0.0",
    "eslint-plugin-react": "^7.34.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.2.5",
    "jest": "^29.7.0",
    "@testing-library/react": "^14.2.1",
    "@testing-library/jest-dom": "^6.4.0",
    "typescript": "^5.4.0"
  }
}
'@
$frontendPkg | Out-File -FilePath frontend\package.json -Encoding utf8 -Force

# Frontend Dockerfile
$frontendDocker = @"
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]
"@
$frontendDocker | Out-File -FilePath frontend\Dockerfile -Encoding utf8 -Force

# Docker Compose
$compose = @"
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: appdb
    ports:
      - "5432:5432"
"@
$compose | Out-File -FilePath docker-compose.yml -Encoding utf8 -Force

Write-Host "Kurulum tamamlandı!"