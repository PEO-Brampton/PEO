// Basic TypeScript entry point
console.log('TypeScript initialized'); 

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, orderBy, writeBatch } from 'firebase/firestore';
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
    apiKey: "AIzaSyDxGxGxGxGxGxGxGxGxGxGxGxGxGxGxGxGx",
    authDomain: "peo-bridge-building-competition.firebaseapp.com",
    projectId: "peo-bridge-building-competition",
    storageBucket: "peo-bridge-building-competition.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Leaderboard state
type SortDirection = 'asc' | 'desc';
let currentSort = {
    field: 'score',
    direction: 'desc' as SortDirection
};

// Update leaderboards
async function updateLeaderboards() {
    try {
        // Get all participants
        const participantsRef = collection(db, 'participants');
        const participantsQuery = query(
            participantsRef,
            where('status', 'in', ['judged', 'qualified']),
            orderBy('status'),
            orderBy('score', 'desc')
        );
        
        const querySnapshot = await getDocs(participantsQuery);
        const participants = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Participant[];

        // Clear existing rows
        const juniorTable = document.getElementById('junior-leaderboard')?.querySelector('tbody');
        const seniorTable = document.getElementById('senior-leaderboard')?.querySelector('tbody');
        
        if (juniorTable) juniorTable.innerHTML = '';
        if (seniorTable) seniorTable.innerHTML = '';

        // Sort participants based on current sort state
        participants.sort((a, b) => {
            let comparison = 0;
            switch (currentSort.field) {
                case 'teamNumber':
                    comparison = a.teamNumber.localeCompare(b.teamNumber);
                    break;
                case 'teamName':
                    comparison = a.teamName.localeCompare(b.teamName);
                    break;
                case 'status':
                    comparison = a.status.localeCompare(b.status);
                    break;
                case 'score':
                    comparison = (b.score || 0) - (a.score || 0);
                    break;
            }
            return currentSort.direction === 'asc' ? comparison : -comparison;
        });

        // Update tables
        participants.forEach(participant => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${participant.teamNumber}</td>
                <td>${participant.teamName}</td>
                <td>${participant.status}</td>
                <td>${participant.score || 0}</td>
                <td>${participant.mostAdventurous ? 'Yes' : 'No'}</td>
            `;

            // Make sure we're appending to the correct table based on category
            if (participant.category === 'junior' && juniorTable) {
                juniorTable.appendChild(row);
            } else if (participant.category === 'senior' && seniorTable) {
                seniorTable.appendChild(row);
            }
        });

        // Update sort indicators
        updateSortIndicators();
    } catch (error) {
        console.error('Error updating leaderboards:', error);
    }
}

// Update sort indicators
function updateSortIndicators() {
    const tables = ['junior-leaderboard', 'senior-leaderboard'];
    tables.forEach(tableId => {
        const table = document.getElementById(tableId);
        if (!table) return;

        // Remove existing sort indicators
        table.querySelectorAll('th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
        });

        // Add sort indicator to active header
        const headers = table.querySelectorAll('th');
        headers.forEach(header => {
            const field = header.getAttribute('data-sort');
            if (field === currentSort.field) {
                header.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });
    });
}

// Handle sort
function handleSort(event: Event) {
    const header = event.target as HTMLElement;
    if (!header.matches('th')) return;

    const field = header.getAttribute('data-sort');
    if (!field) return;

    if (field === currentSort.field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'desc' as SortDirection;
    }

    updateLeaderboards();
}

// Add sort event listeners
document.addEventListener('DOMContentLoaded', () => {
    const tables = ['junior-leaderboard', 'senior-leaderboard'];
    tables.forEach(tableId => {
        const table = document.getElementById(tableId);
        if (table) {
            table.querySelectorAll('th[data-sort]').forEach(header => {
                header.addEventListener('click', handleSort);
            });
        }
    });

    // Initial update
    updateLeaderboards();
});

// Update team status
async function updateTeamStatus(teamNumber: string, newStatus: 'judged' | 'qualified') {
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
        await updateLeaderboards();
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