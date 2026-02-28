/** @type {import('tailwindcss').Config} */
import heroui from './src/styles/hero';

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        secondary: {
          500: '#ec4899',
        },
        accent: {
          500: '#8b5cf6',
        },
        // Liquid Glass Colors
        glass: {
          bg: 'rgba(255, 255, 255, 0.10)',
          'bg-hover': 'rgba(255, 255, 255, 0.15)',
          'bg-active': 'rgba(255, 255, 255, 0.20)',
          border: 'rgba(255, 255, 255, 0.12)',
          'border-hover': 'rgba(255, 255, 255, 0.18)',
          specular: 'rgba(255, 255, 255, 0.25)',
          shadow: 'rgba(0, 0, 0, 0.25)',
        },
      },
      fontFamily: {
        sans: ['Lexend', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        // Liquid Glass Blur Levels (iOS 26 style)
        'glass-xs': '4px',      // Subtle hint
        'glass-sm': '8px',      // Light blur
        'glass': '16px',        // Standard glass
        'glass-md': '20px',     // Medium glass
        'glass-lg': '30px',     // Heavy glass
        'glass-xl': '40px',     // Maximum blur
      },
      boxShadow: {
        // 3D Depth Shadows
        'depth-near': '0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 8px rgba(0, 0, 0, 0.2)',
        'depth-mid': '0 4px 16px rgba(0, 0, 0, 0.2), 0 1px 4px rgba(0, 0, 0, 0.15)',
        'depth-far': '0 2px 8px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.08)',
        // 3D Glow Effects
        'glow-cyan': '0 0 30px rgba(6, 182, 212, 0.4), 0 0 60px rgba(6, 182, 212, 0.2)',
        'glow-cyan-lg': '0 0 40px rgba(6, 182, 212, 0.5), 0 0 80px rgba(6, 182, 212, 0.3)',
        'glow-purple': '0 0 30px rgba(139, 92, 246, 0.4), 0 0 60px rgba(139, 92, 246, 0.2)',
        // Inset 3D Effects
        'inset-3d': 'inset 0 2px 4px rgba(0, 0, 0, 0.1), inset 0 -1px 2px rgba(255, 255, 255, 0.1)',
        'inset-3d-dark': 'inset 0 2px 4px rgba(0, 0, 0, 0.3), inset 0 -1px 2px rgba(255, 255, 255, 0.05)',
        // Liquid Glass Shadows
        'glass': '0 8px 32px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        'glass-lg': '0 12px 48px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        'glass-glow': '0 8px 32px rgba(6, 182, 212, 0.15), 0 0 0 1px rgba(6, 182, 212, 0.1)',
        // Press/Active State Shadow
        'glass-pressed': 'inset 0 2px 8px rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'toast-in': 'toastIn 0.3s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 3s ease-in-out infinite',
        'tilt': 'tilt 10s ease-in-out infinite',
        'rotate-3d': 'rotate3d 20s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        tilt: {
          '0%, 100%': { transform: 'rotateY(-5deg) rotateX(2deg)' },
          '50%': { transform: 'rotateY(5deg) rotateX(-2deg)' },
        },
        rotate3d: {
          '0%': { transform: 'rotateY(0deg)' },
          '100%': { transform: 'rotateY(360deg)' },
        },
      },
      perspective: {
        '500': '500px',
        '1000': '1000px',
        '1500': '1500px',
        '2000': '2000px',
      },
      transformStyle: {
        '3d': 'preserve-3d',
      },
    },
  },
  plugins: [heroui],
}