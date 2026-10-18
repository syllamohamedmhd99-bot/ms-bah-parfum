/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 1. Vert foncé principal (#176B52)
        primary: {
          DEFAULT: '#176B52',
          hover: '#125541',
          active: '#0E4233',
          light: '#EBF4F0',
          50: '#F0F7F4',
          100: '#E1EFEA',
          200: '#C2DFD4',
          600: '#176B52',
          700: '#125541',
          800: '#0E4031',
          900: '#092C22',
        },
        // 2. Gris très clair (#F4F6F3) pour l'arrière-plan général
        workspace: {
          DEFAULT: '#F4F6F3',
          dark: '#E9ECE8',
        },
        // 3. Blanc (#FFFFFF) pour les cartes et surfaces
        surface: {
          DEFAULT: '#FFFFFF',
          card: '#FFFFFF',
          border: '#E1E6E2',
          subtle: '#F4F6F3',
        },
        // 4. Orange (#D97732) réservé aux alertes et avertissements
        alert: {
          DEFAULT: '#D97732',
          hover: '#BF6425',
          light: '#FDF3EB',
          border: '#F6CEB4',
        },
        // Textes courants
        apptext: {
          DEFAULT: '#1F2937',
          muted: '#64748B',
          light: '#94A3B8',
        }
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.03)' }
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in-up': 'fade-in-up 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in-down': 'fade-in-down 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in': 'scale-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-subtle': 'pulse-subtle 2.5s infinite ease-in-out',
      }
    },
  },
  plugins: [],
}
