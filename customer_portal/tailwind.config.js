/** @type {import('tailwindcss').Config} */
export default {
     content: [
          "./index.html",
          "./src/**/*.{js,ts,jsx,tsx}",
     ],
     theme: {
          extend: {
               colors: {
                    primary: {
                         50: '#f0fdf4',
                         100: '#dcfce7',
                         500: '#22c55e',
                         600: '#16a34a',
                         700: '#15803d',
                    },
                    brand: {
                         dark: '#0f172a',    // Tailwind slate-900
                         light: '#f8fafc',   // Tailwind slate-50
                         accent: '#3b82f6',  // Tailwind blue-500
                    }
               },
               fontFamily: {
                    sans: ['Inter', 'system-ui', 'sans-serif'],
               },
               boxShadow: {
                    glass: '0 4px 30px rgba(0, 0, 0, 0.1)',
               }
          },
     },
     plugins: [],
}
