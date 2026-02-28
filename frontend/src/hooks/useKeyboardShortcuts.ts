/**
 * Keyboard Shortcuts Hook & Utilities
 * Power user'lar için klavye kısayolları
 */

import React, { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  keys: string[]; // ['Ctrl', 'K'] or ['Shift', 'Ctrl', 'K']
  description: string;
  action: () => void;
  preventDefault?: boolean;
}

const modifierMap = {
  Ctrl: 'ctrlKey',
  Cmd: 'metaKey',
  Alt: 'altKey',
  Shift: 'shiftKey',
} as const;

/**
 * useKeyboardShortcuts Hook
 * @example
 *   useKeyboardShortcuts([
 *     {
 *       keys: ['Ctrl', 'K'],
 *       description: 'Araç aç',
 *       action: () => openSearch(),
 *     },
 *     {
 *       keys: ['Escape'],
 *       description: 'Kapat',
 *       action: () => closeModal(),
 *     },
 *   ]);
 */
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const modifiers = shortcut.keys.filter(
          (k) => k in modifierMap,
        ) as (keyof typeof modifierMap)[];
        const keys = shortcut.keys.filter((k) => !(k in modifierMap));

        let matches = true;

        // Check modifiers
        for (const modifier of modifiers) {
          if (!e[modifierMap[modifier]]) {
            matches = false;
            break;
          }
        }

        // Check main key (case-insensitive for letters)
        if (matches && keys.length > 0) {
          const mainKey = keys[0].toLowerCase();
          const eventKey = e.key.toLowerCase();

          if (mainKey === 'escape') {
            matches = e.code === 'Escape';
          } else if (mainKey === 'enter') {
            matches = e.code === 'Enter';
          } else {
            matches = eventKey === mainKey;
          }
        }

        if (matches) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
          }
          shortcut.action();
          return; // Stop at first match
        }
      }
    },
    [shortcuts],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

/**
 * Shortcut help dialog
 */
export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  // NAVİGASYON
  {
    keys: ['Ctrl', 'K'],
    description: 'Global arama açarsını',
    action: () => {},
  },
  {
    keys: ['Ctrl', '1'],
    description: 'Dashboard',
    action: () => {},
  },
  {
    keys: ['Ctrl', '2'],
    description: 'Siparişler',
    action: () => {},
  },
  {
    keys: ['Ctrl', '3'],
    description: 'Raporlar',
    action: () => {},
  },
  {
    keys: ['Ctrl', '4'],
    description: 'CRM',
    action: () => {},
  },
  {
    keys: ['Ctrl', '5'],
    description: 'Ayarlar',
    action: () => {},
  },

  // EYLEMLER
  {
    keys: ['Ctrl', 'N'],
    description: 'Yeni sipariş oluştur',
    action: () => {},
  },
  {
    keys: ['Ctrl', 'Shift', 'N'],
    description: 'Hızlı sipariş modalı',
    action: () => {},
  },
  {
    keys: ['Ctrl', 'E'],
    description: 'Seçili siparişi düzenle',
    action: () => {},
  },
  {
    keys: ['Ctrl', 'D'],
    description: 'Seçili siparişi sil',
    action: () => {},
  },

  // ARAYÜZ
  {
    keys: ['Escape'],
    description: 'Modal/Panel kapat',
    action: () => {},
  },
  {
    keys: ['Ctrl', 'Enter'],
    description: 'Form gönder',
    action: () => {},
  },
  {
    keys: ['Ctrl', 'R'],
    description: 'Sayfayı yenile',
    action: () => {},
  },
  {
    keys: ['Ctrl', 'S'],
    description: 'Taslak kaydet',
    action: () => {},
  },
  {
    keys: ['Ctrl', 'F'],
    description: 'Sayfa içinde ara',
    action: () => {},
  },
  {
    keys: ['Shift', 'Ctrl', 'T'],
    description: 'Tema değiştir',
    action: () => {},
  },
  {
    keys: ['Shift', 'Ctrl', 'K'],
    description: 'Sidebar aç/kapat',
    action: () => {},
  },
  {
    keys: ['Ctrl', '/'],
    description: 'Bu yardımı göster',
    action: () => {},
  },
];

/**
 * useShortcutHelp Hook
 * Shortcut yardım diyalogunu göster/gizle
 */
export const useShortcutHelp = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  useKeyboardShortcuts([
    {
      keys: ['Ctrl', '/'],
      description: 'Yardımı göster',
      action: () => setIsOpen((prev) => !prev),
    },
  ]);

  return { isOpen, setIsOpen };
};
