/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Light surfaces (replaces old dark ink palette)
        ink: {
          900: '#f8f9fa',
          800: '#ffffff',
          700: '#ffffff',
          600: '#f3f4f6',
          500: '#e5e7eb',
          400: '#d1d5db',
        },
        // Remap cyan → indigo/purple (touches all text-cyan-*, bg-cyan-*, etc.)
        cyan: {
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        neon: {
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
        },
        // Remap zinc: flip dark→light so existing text-zinc-100/200/300 work on white bg
        zinc: {
          50:  '#fafafa',
          100: '#111827',
          200: '#1f2937',
          300: '#374151',
          400: '#6b7280',
          500: '#9ca3af',
          600: '#d1d5db',
          700: '#e5e7eb',
          800: '#f3f4f6',
          900: '#f9fafb',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(99,102,241,0.2), 0 4px 16px -4px rgba(99,102,241,0.15)',
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      },
      fontFamily: {
        display: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
