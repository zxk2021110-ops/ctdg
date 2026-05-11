// Firebase 配置
const firebaseConfig = {
  apiKey: "AIzaSyDpmZtCrseWkYCdX33leb9L408TuRSy6e8",
  authDomain: "pethome-b2a41.firebaseapp.com",
  projectId: "pethome-b2a41",
  storageBucket: "pethome-b2a41.firebasestorage.app",
  messagingSenderId: "811219760597",
  appId: "1:811219760597:web:83a569289d4241e4dff95c",
  measurementId: "G-NXF8G8YR7D"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
