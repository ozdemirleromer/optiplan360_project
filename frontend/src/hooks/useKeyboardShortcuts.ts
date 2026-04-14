/**


 * Keyboard Shortcuts Hook & Utilities


 * Power user'lar için klavye kısayolları


 */





import { useEffect, useCallback } from 'react';





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
