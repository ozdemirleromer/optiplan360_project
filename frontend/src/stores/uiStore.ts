import { create } from 'zustand';

import { persist } from 'zustand/middleware';

import type { ThemeName } from '../themes';

import { syncRuntimeTheme } from '../themeRuntime';



interface UIState {

  theme: 'light' | 'dark';

  themeName: ThemeName;

  sidebarCollapsed: boolean;

  toggleTheme: () => void;

  toggleSidebar: () => void;

  setSidebarCollapsed: (collapsed: boolean) => void;

  setThemeName: (name: ThemeName) => void;

}



const DEFAULT_THEME_NAME: ThemeName = 'industrialGrid';



syncRuntimeTheme(DEFAULT_THEME_NAME);



export const useUIStore = create<UIState>()(

  persist(

    (set) => ({

      theme: 'dark',

      themeName: DEFAULT_THEME_NAME,

      sidebarCollapsed: false,

      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      setThemeName: (name) => {

        void name;

        syncRuntimeTheme(DEFAULT_THEME_NAME);

        set({ themeName: DEFAULT_THEME_NAME });

      },

    }),

    {

      name: 'optiplan-ui-storage',

      onRehydrateStorage: () => (state) => {

        if (!state) {

          return;

        }

        if (state.themeName !== DEFAULT_THEME_NAME) {

          state.setThemeName(DEFAULT_THEME_NAME);

          return;

        }

        syncRuntimeTheme(DEFAULT_THEME_NAME);

      },

    },

  ),

);


