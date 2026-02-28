import sys
print('Python:', sys.version)
pkgs = ['openai', 'openpyxl', 'pandas', 'pdfplumber', 'pytesseract', 'fitz']
for pkg in pkgs:
    try:
        mod = __import__(pkg)
        ver = getattr(mod, '__version__', 'ok')
        print(f'  {pkg}: {ver}')
    except ImportError:
        print(f'  {pkg}: NOT INSTALLED')
import os
key = os.getenv('OPENAI_API_KEY')
if key:
    print(f'  OPENAI_API_KEY: set ({key[:8]}...)')
else:
    print('  OPENAI_API_KEY: NOT SET')
