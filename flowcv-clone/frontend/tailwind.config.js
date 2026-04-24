/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Dark surfaces
        ink: {
          900: '#050508',   // page
          800: '#0a0a0f',   // chrome
          700: '#111118',   // cards
          600: '#17171f',   // hover
          500: '#1e1e28',   // borders active
          400: '#2a2a36',   // borders subtle
        },
        // Cyan/electric accent
        neon: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.4), 0 0 20px -5px rgba(34,211,238,0.5)',
        card: '0 0 0 1px rgba(255,255,255,0.05), 0 8px 24px -12px rgba(0,0,0,0.6)',
      },
      fontFamily: {
        display: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
