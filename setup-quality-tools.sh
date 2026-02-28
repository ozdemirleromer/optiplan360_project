#!/bin/bash
# setup-quality-tools.sh
# Kod kontrol araçlarını kur ve setup et

set -e

echo "=========================================="
echo "📦 Kod Kalitesi Araçlarını Kuruyoruz..."
echo "=========================================="

VENV_PATH="${1:-./.venv}"

# Python environment aktif et
if [ -d "$VENV_PATH" ]; then
    source "$VENV_PATH/bin/activate"
else
    echo "⚠️  Virtualenv bulunamadı: $VENV_PATH"
    echo "✓ Python environment'ını kur:"
    echo "  python -m venv $VENV_PATH"
    exit 1
fi

echo ""
echo "1️⃣  Linting & Formatting araçları yükleniyor..."
pip install -q black isort flake8 flake8-bugbear flake8-docstrings

echo "2️⃣  Type checking araçları yükleniyor..."
pip install -q mypy types-all

echo "3️⃣  Advanced analysis araçları yükleniyor..."
pip install -q pylint bandit

echo "4️⃣  Code complexity araçları yükleniyor..."
pip install -q radon

echo "5️⃣  Pre-commit framework yükleniyor..."
pip install -q pre-commit

echo ""
echo "✅ Pre-commit hooks kuruluyor..."
pre-commit install

echo ""
echo "=========================================="
echo "✅ Kurulum tamamlandı!"
echo "=========================================="
echo ""
echo "🎯 Hemen kullan:"
echo "   python quality_check.py --fast       # Hızlı kontrol"
echo "   python quality_check.py --full       # Tam kontrol"
echo "   python quality_check.py --security   # Güvenlik kontrol"
echo ""
echo "🔧 Manuel komutlar:"
echo "   pre-commit run --all-files           # Tüm dosyaları kontrol et"
echo "   black backend --line-length=100      # Format et"
echo "   flake8 backend --statistics          # Lint et"
echo "   mypy backend                         # Type check et"
echo ""
