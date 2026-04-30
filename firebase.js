// Firebase configuration for the student task manager project
const firebaseConfig = {
    apiKey: "AIzaSyC90rL1qXD8dAHAoM5ahT90jyiY9rFH-Bo",
    authDomain: "student-task-manager-f581d.firebaseapp.com",
    projectId: "student-task-manager-f581d",
    storageBucket: "student-task-manager-f581d.firebasestorage.app",
    messagingSenderId: "1011769467568",
    appId: "1:1011769467568:web:b242c76b652223fd141175"
};

// Connect the website to Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
