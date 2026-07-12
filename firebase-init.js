import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
// قمنا هنا باستدعاء جميع أدوات قاعدة البيانات (Firestore) اللازمة للعمل
import { 
    getFirestore, 
    collection, 
    getDocs, 
    getDoc, 
    addDoc, 
    setDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

// إعدادات مشروعك تم توحيدها لتطابق لوحة تحكم الأدمن (ijipj-53462)
const firebaseConfig = {
    apiKey: "AIzaSyDzhfG057uqOvk1gzbBsV4RgoljVpEVJgo",
    authDomain: "ijipj-53462.firebaseapp.com",
    projectId: "ijipj-53462",
    storageBucket: "ijipj-53462.firebasestorage.app",
    messagingSenderId: "696575806658",
    appId: "1:696575806658:web:224d3e3fcd02fcab92ff5b"
};

// تهيئة التطبيق
const app = initializeApp(firebaseConfig);

// الاتصال بقاعدة البيانات
const db = getFirestore(app);

// هذه الخطوة مهمة جداً: نجعل أدوات قاعدة البيانات متاحة لملف script.js لكي يستخدمها
window.db = db;
window.firestore = {
    collection,
    getDocs,
    getDoc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    serverTimestamp
};

// إطلاق إشارة لباقي ملفات المشروع أن الاتصال بقاعدة البيانات جاهز ويمكنهم البدء
const event = new Event('firebaseReady');
window.dispatchEvent(event);
