/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        bg: { base: '#0b0c14', raised: '#0d0e15', deep: '#14172a' },
        accent: { violet: '#8b9bff', purple: '#bd93f9', teal: '#6fe6cf' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
