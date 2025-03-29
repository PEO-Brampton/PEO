// Basic TypeScript entry point
console.log('TypeScript initialized'); 

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, writeBatch, Firestore } from 'firebase/firestore';
import './styles.css';

// Types
interface Participant {
    id: string;
    teamNumber: string;
    teamName: string;
    status: 'judged' | 'qualified';
    score: number;
    category: 'junior' | 'senior';
    firstName: string;
    lastName: string;
    grade: string;
    schoolName: string;
    arrivalTime?: string;
    waiver: boolean;
    mostAdventurous?: boolean;
}

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDr6fbYSOMuNivKrd8tPxhyaKq_aE2J2B4",
    authDomain: "peo-a-1ad2b.firebaseapp.com",
    databaseURL: "https://peo-a-1ad2b-default-rtdb.firebaseio.com",
    projectId: "peo-a-1ad2b",
    storageBucket: "peo-a-1ad2b.firebasestorage.app",
    messagingSenderId: "373859495373",
    appId: "1:373859495373:web:209555ee02b3bcc945e884"
};

// Initialize Firebase
let app;
let db: Firestore | undefined;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Error initializing Firebase:', error);
}

// Update team status
async function updateTeamStatus(teamNumber: string, newStatus: 'judged' | 'qualified') {
    if (!db) {
        console.error('Firebase not initialized');
        return;
    }

    try {
        // Get all participants with the same team number
        const participantsRef = collection(db, 'participants');
        const teamQuery = query(
            participantsRef,
            where('teamNumber', '==', teamNumber)
        );
        
        const querySnapshot = await getDocs(teamQuery);
        console.log(`Found ${querySnapshot.size} team members for team ${teamNumber}`);
        
        if (querySnapshot.empty) {
            console.error(`No team members found for team ${teamNumber}`);
            return;
        }

        const batch = writeBatch(db);
        
        // Update each team member's status
        querySnapshot.docs.forEach(doc => {
            console.log(`Updating status for team member ${doc.id}`);
            batch.update(doc.ref, { 
                status: newStatus,
                updatedAt: new Date().toISOString()
            });
        });
        
        // Commit the batch update
        await batch.commit();
        console.log(`Successfully updated status for all team members of team ${teamNumber}`);
        
        // Update the UI
        await updateParticipantsTable();
    } catch (error) {
        console.error('Error updating team status:', error);
    }
}

// Handle qualification form submission
document.getElementById('qualification-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const teamSelect = document.getElementById('qualification-team-select') as HTMLSelectElement;
    const teamNumber = teamSelect.value;
    
    if (!teamNumber) return;
    
    await updateTeamStatus(teamNumber, 'qualified');
    teamSelect.value = '';
});

// Handle judging form submission
document.getElementById('judging-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const teamSelect = document.getElementById('team-select') as HTMLSelectElement;
    const teamNumber = teamSelect.value;
    
    if (!teamNumber) return;
    
    await updateTeamStatus(teamNumber, 'judged');
    teamSelect.value = '';
});

// Update participants table
async function updateParticipantsTable() {
    if (!db) {
        console.error('Firebase not initialized');
        return;
    }

    try {
        const participantsRef = collection(db, 'participants');
        const querySnapshot = await getDocs(participantsRef);
        const participants = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Participant[];

        const tbody = document.getElementById('participants-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        participants.forEach(participant => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${participant.teamNumber}</td>
                <td>${participant.teamName}</td>
                <td>${participant.firstName}</td>
                <td>${participant.lastName}</td>
                <td>${participant.grade}</td>
                <td>${participant.schoolName}</td>
                <td>${participant.category}</td>
                <td>${participant.arrivalTime || ''}</td>
                <td>${participant.waiver ? 'Yes' : 'No'}</td>
                <td>${participant.status || 'checked-in'}</td>
                <td>
                    <button class="action-button check-in-btn" data-id="${participant.id}">Check In</button>
                    <button class="action-button waiting-btn" data-id="${participant.id}">Waiting</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error updating participants table:', error);
    }
} 