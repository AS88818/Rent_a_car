/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lime: {
          400: '#D4FF14',
          500: '#C4FF0D',
          600: '#B0E80C',
          700: '#9CD00A',
        },
        cream: {
          50: '#FDFBF7',
          100: '#FAF6F0',
          200: '#F5EFE5',
          300: '#F0E8DA',
        },
        neutral: {
          800: '#2D2D2D',
          900: '#1A1A1A',
        }
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card': '0 4px 12px rgba(0, 0, 0, 0.06)',
        'hover': '0 8px 24px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};
