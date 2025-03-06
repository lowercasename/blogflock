/** @type {import('tailwindcss').Config} */
export default {
  content: ["./views/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        "sharp": "5px 5px 0 rgba(0, 0, 0, 0.03), 2px 2px 0 rgba(0, 0, 0, 0.08)",
      },
      fontFamily: {
        "rethink-sans": ["Rethink Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
};
