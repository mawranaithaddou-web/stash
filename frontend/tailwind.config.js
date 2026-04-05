/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "index.html",
    "./assets/js/**/*.js", // Scans your app.js and api.js
    "./pages/*.html"    // Scans any sub-pages
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}