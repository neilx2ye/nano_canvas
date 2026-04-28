/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary
        black: '#000000',
        'near-black': '#262626',
        // Surface & Background
        white: '#ffffff',
        snow: '#fafafa',
        'light-gray': '#e5e5e5',
        // Neutrals
        stone: '#737373',
        'mid-gray': '#525252',
        silver: '#a3a3a3',
        'button-text-dark': '#404040',
        'border-light': '#d4d4d4',
        // Dark surfaces
        'darkest': '#090909',
      },
      fontFamily: {
        display: ['"SF Pro Rounded"', 'system-ui', '-apple-system', 'sans-serif'],
        sans: ['ui-sans-serif', 'system-ui', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
      },
      borderRadius: {
        pill: '9999px',
        container: '12px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}
