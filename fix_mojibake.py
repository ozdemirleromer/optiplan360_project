#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fix mojibake encoding issues in source files."""

from pathlib import Path

# Mojibake to correct character mappings
REPLACEMENTS = {
    'Ã§': 'ç',     # c cedilla
    'Ã¼': 'ü',     # u umlaut
    'Ã©': 'é',     # e acute
    'Ã¶': 'ö',     # o umlaut
    'Ã§': 'ç',     # c cedilla (variant)
    'Ã¡': 'á',     # a acute
    'Ã ': 'à',     # a grave
    'Ã©': 'é',     # e acute (variant)
    'Ã­': 'í',     # i acute
    'Ã³': 'ó',     # o acute
    'Ãº': 'ú',     # u acute
    'Ã±': 'ñ',     # n tilde
    'Ã§': 'ç',     # more variants
    'Â±': '±',     # plus-minus
    'â€™': "'",    # smart single quote
    'â€œ': '"',    # smart double quote
    'â€': '–',     # en dash
    'â€"': '—',    # em dash
}

def fix_mojibake():
    """Fix mojibake in all source files."""
    fix_count = 0
    
    for root_dir in ['backend', 'frontend']:
        root = Path(root_dir)
        if not root.exists():
            continue
            
        for file_path in root.rglob('*'):
            # Skip non-text files
            if file_path.suffix not in ['.py', '.ts', '.tsx', '.js', '.jsx', '.md']:
                continue
            
            # Skip ignored directories
            if any(x in file_path.parts for x in ['__pycache__', '.venv', 'node_modules', '.git']):
                continue
            
            try:
                content = file_path.read_text(encoding='utf-8')
                original = content
                
                # Replace mojibake characters
                for mojibake, correct in REPLACEMENTS.items():
                    content = content.replace(mojibake, correct)
                
                # Write back if changed
                if content != original:
                    file_path.write_text(content, encoding='utf-8')
                    fix_count += 1
                    print(f"✅ {file_path.relative_to('.')}")
                    
            except Exception as e:
                pass
    
    return fix_count

if __name__ == '__main__':
    print("=" * 60)
    print("MOJIBAKE FIX - Turkish Character Restoration")
    print("=" * 60)
    
    count = fix_mojibake()
    
    print("=" * 60)
    print(f"✅ Düzeltildi: {count} dosya")
    print("=" * 60)
