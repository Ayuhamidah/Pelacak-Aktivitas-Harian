// Global State Variables
let allActivities = [];
let currentUser = null;
let userActivitiesRef = null;
let isLoginMode = true;
let categoryChartInstance = null;
let weeklyChartInstance = null;

// VARIABEL PAGINASI BARU
let currentPage = 1;
let itemsPerPage = 10;

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCR-1GY2yjkkmCBm-vSCiWxbGlQ_Wgpu0c", // Ganti dengan API Key asli milikmu
  authDomain: "crudfb3.firebaseapp.com",
  databaseURL: "https://crudfb3.firebaseio.com",
  projectId: "crudfb3",
  storageBucket: "crudfb3.appspot.com",
  messagingSenderId: "970524897736",
  appId: "1:970524897736:web:33a524ae05c33ee95d90fd"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
