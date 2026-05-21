export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Outfit', 'sans-serif'] },
      colors: {
        brand: {
          50:  'var(--accent-surface)',
          100: 'var(--accent-muted)',
          300: 'var(--accent-light)',
          400: 'var(--accent)',
          500: 'var(--accent-dark)',
          600: 'var(--accent-darker)',
        },
        cream: 'var(--bg)',
      },
    },
  },
  plugins: [],
};
