/** @type {import('tailwindcss').Config} */
module.exports = {
  // Optimize content paths for better tree-shaking
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    // Exclude test files and stories
    '!./src/**/*.test.{js,ts,jsx,tsx}',
    '!./src/**/*.stories.{js,ts,jsx,tsx}',
  ],
  // Enable JIT mode for better performance
  mode: 'jit',
  theme: {
    extend: {
      colors: {
        // Premium Navy Blue Primary - Only include used shades
        primary: {
          50: '#f1f5f9',
          100: '#e2e8f0',
          200: '#cbd5e0',
          400: '#718096',
          500: '#4a5568',
          600: '#2d3748',
          700: '#1a202c',
          800: '#171923',
          900: '#1a365d',
        },
        // Premium Navy variants - Only include used shades
        navy: {
          50: '#f0f4ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#3730a3',
          900: '#1e1b4b',
        },
        // Silver/Platinum accents - Only include used shades
        silver: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e0',
          500: '#718096',
          600: '#4a5568',
        },
        // Luxury Gold highlights - Only include used shades
        gold: {
          100: '#fef3c7',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
        },
        // Keep only necessary neutral grays
        neutral: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#eeeeee',
          300: '#e0e0e0',
          500: '#9e9e9e',
          700: '#616161',
          900: '#212121',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Playfair Display', 'serif'],
      },
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
      },
      // Only include necessary animations
      animation: {
        'fade-in': 'fadeIn 0.8s ease-in-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      // Only include necessary box shadows
      boxShadow: {
        'premium': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class', // Use class strategy to reduce CSS size
    }),
    require('@tailwindcss/typography'),
  ],
  // Optimize for production
  corePlugins: {
    // Disable unused core plugins
    float: false,
    clear: false,
    skew: false,
    sepia: false,
    contrast: false,
    brightness: false,
    hueRotate: false,
    invert: false,
    saturate: false,
    backdropBlur: false,
    backdropBrightness: false,
    backdropContrast: false,
    backdropGrayscale: false,
    backdropHueRotate: false,
    backdropInvert: false,
    backdropOpacity: false,
    backdropSaturate: false,
    backdropSepia: false,
  },
};