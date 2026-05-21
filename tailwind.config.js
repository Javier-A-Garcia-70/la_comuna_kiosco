export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Outfit', 'sans-serif'] },
      colors: {
        brand: {
          50:  '#F5EDE8',
          100: '#EDD9CF',
          300: '#E8A98C',
          400: '#D4856A',
          500: '#C4755A',
          600: '#A85E45',
        },
        cream: '#F5F3EF',
      },
    },
  },
  plugins: [],
};
