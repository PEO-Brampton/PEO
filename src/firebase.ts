import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore, enableIndexedDbPersistence, initializeFirestore, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDr6fbYSOMuNivKrd8tPxhyaKq_aE2J2B4",
    authDomain: "peo-a-1ad2b.firebaseapp.com",
    projectId: "peo-a-1ad2b",
    storageBucket: "peo-a-1ad2b.firebasestorage.app",
    messagingSenderId: "373859495373",
    appId: "1:373859495373:web:209555ee02b3bcc945e884"
};

// Initialize Firebase
let app;
try {
    app = initializeApp(firebaseConfig);
} catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
}

// Initialize Firestore with settings
let db: Firestore;
try {
    // Initialize Firestore with specific settings
    db = initializeFirestore(app, {
        cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        experimentalForceLongPolling: true,
        ignoreUndefinedProperties: true
    });
    
    // Enable offline persistence
    enableIndexedDbPersistence(db)
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                // Multiple tabs open, persistence can only be enabled in one tab at a time.
                console.warn('Firebase persistence failed: Multiple tabs open');
            } else if (err.code === 'unimplemented') {
                // The current browser doesn't support persistence
                console.warn('Firebase persistence not available');
            }
        });
} catch (error) {
    console.error('Error initializing Firestore:', error);
    throw error;
}

export { db }; 