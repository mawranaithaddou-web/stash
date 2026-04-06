import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
// Add other services like getAuth or getFirestore here

const firebaseConfig = {
  apiKey: "AIzaSyAIIXZgGcVYyuqOCUm_rAgpqgZDJs_3WJk",
  authDomain: "vintage-shop-35421.firebaseapp.com",
  projectId: "vintage-shop-35421",
  storageBucket: "vintage-shop-35421.firebasestorage.app",
  messagingSenderId: "619754582329",
  appId: "1:619754582329:web:04e99d7aa961f9c1c778e8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
const storage = getStorage(app);

export { app, storage };