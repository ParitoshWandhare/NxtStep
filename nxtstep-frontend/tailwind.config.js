/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#d4a017',
          600: '#b8870f',
          700: '#9a6e0d',
          800: '#7c560a',
          900: '#5e4008',
          950: '#3d2904',
        },
        secondary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#c2851a',
          600: '#a8700f',
          700: '#8c5c0c',
          800: '#704a0a',
          900: '#543807',
          950: '#382505',
        },
        accent: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#e8a020',
          600: '#cc8a14',
          700: '#b07510',
          800: '#92600c',
          900: '#744c09',
          950: '#4a3006',
        },
        dark: {
          50: '#faf9f4',
          100: '#f5f2e8',
          200: '#e8e5d8',
          bg: '#0e0d08',
          card: '#18160c',
          border: '#2a2618',
          muted: '#1e1b0e',
          elevated: '#1e1b0e',
        },
        surface: {
          light: '#ffffff',
          dark: '#18160c',
        },
      },
      fontFamily: {
        sans: ['"Outfit"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Outfit"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'glow-sm': '0 0 10px 0 rgba(212, 160, 23, 0.2)',
        glow: '0 0 20px 0 rgba(212, 160, 23, 0.35)',
        'glow-lg': '0 0 40px 0 rgba(212, 160, 23, 0.45)',
        'inner-glow': 'inset 0 0 20px 0 rgba(212, 160, 23, 0.1)',
        card: '0 1px 3px rgba(26,26,14,0.1), 0 1px 2px rgba(26,26,14,0.12)',
        'card-hover': '0 14px 28px rgba(26,26,14,0.15), 0 10px 10px rgba(26,26,14,0.10)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'mesh-primary': 'radial-gradient(at 40% 20%, rgba(212,160,23,0.25) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(194,133,26,0.15) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(232,160,32,0.1) 0px, transparent 50%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'bounce-subtle': 'bounceSubtle 1s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'typing': 'typing 1.5s steps(3) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(212,160,23,0.35)' },
          '50%': { boxShadow: '0 0 25px rgba(212,160,23,0.65), 0 0 50px rgba(212,160,23,0.25)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        typing: {
          '0%': { content: '""' },
          '33%': { content: '"."' },
          '66%': { content: '".."' },
          '100%': { content: '"..."' },
        },
      },
      screens: {
        xs: '480px',
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
    },
  },
  plugins: [],
};