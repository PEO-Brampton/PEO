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
    criteria1?: string;
    criteria2?: string;
    criteria3?: string;
    criteria4?: string;
    criteria5?: string;
    judgingScores?: {
        judge: string;
        criteria1: number;
        criteria2: number;
        criteria3: number;
        criteria4: number;
        criteria5: number;
        totalScore: number;
    }[];
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

// Leaderboard state
type SortDirection = 'asc' | 'desc';
let currentSort = {
    field: 'score',
    direction: 'desc' as SortDirection
};

// Update leaderboards
async function updateLeaderboards() {
    if (!db) {
        console.error('Firebase not initialized');
        return;
    }

    try {
        console.log('Updating leaderboards...');
        // Get all participants with status 'judged'
        const participantsRef = collection(db, 'participants');
        console.log('Created participants reference');
        
        const participantsQuery = query(
            participantsRef,
            where('status', '==', 'judged')
        );
        console.log('Created query with status filter');
        
        try {
            const querySnapshot = await getDocs(participantsQuery);
            console.log(`Found ${querySnapshot.size} judged teams`);
            
            const participants = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Participant[];
            console.log('Processed participants:', participants);

            // Clear existing rows
            const juniorTable = document.getElementById('junior-leaderboard')?.querySelector('tbody');
            const seniorTable = document.getElementById('senior-leaderboard')?.querySelector('tbody');
            
            if (!juniorTable || !seniorTable) {
                console.error('Could not find leaderboard tables');
                return;
            }

            juniorTable.innerHTML = '';
            seniorTable.innerHTML = '';

            // Calculate scores and sort participants
            const scoredParticipants = participants.map(participant => {
                // Calculate total score from criteria
                const criteria1 = Number(participant.criteria1) || 0;
                const criteria2 = Number(participant.criteria2) || 0;
                const criteria3 = Number(participant.criteria3) || 0;
                const criteria4 = Number(participant.criteria4) || 0;
                const criteria5 = Number(participant.criteria5) || 0;
                
                const totalScore = criteria1 + criteria2 + criteria3 + criteria4 + criteria5;
                
                return {
                    ...participant,
                    score: totalScore
                };
            });

            // Sort by score in descending order
            scoredParticipants.sort((a, b) => (b.score || 0) - (a.score || 0));

            // Update tables
            scoredParticipants.forEach(participant => {
                console.log(`Processing team: ${participant.teamNumber}, Category: ${participant.category}, Score: ${participant.score}`);
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${participant.teamNumber}</td>
                    <td>${participant.teamName}</td>
                    <td>${participant.status}</td>
                    <td>${participant.score || 0}</td>
                    <td>${participant.mostAdventurous ? 'Yes' : 'No'}</td>
                `;

                if (participant.category === 'junior') {
                    juniorTable.appendChild(row);
                    console.log('Added to junior table');
                } else if (participant.category === 'senior') {
                    seniorTable.appendChild(row);
                    console.log('Added to senior table');
                }
            });

            console.log('Leaderboard update complete');
        } catch (queryError) {
            console.error('Error executing Firestore query:', queryError);
            console.error('Query details:', {
                collection: 'participants',
                filter: 'status == judged'
            });
        }
    } catch (error) {
        console.error('Error in updateLeaderboards:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
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

// Add the ranking update function
async function updateRankings() {
    if (!db) {
        console.error('Firebase not initialized');
        return;
    }

    try {
        console.log('Updating rankings...');
        const participantsRef = collection(db, 'participants');
        const participantsQuery = query(
            participantsRef,
            where('status', 'in', ['judged', 'qualified'])
        );

        const querySnapshot = await getDocs(participantsQuery);
        console.log(`Found ${querySnapshot.size} teams to rank`);

        // Group participants by team number to calculate average scores
        const teamScores = new Map<string, {
            teamNumber: string;
            teamName: string;
            status: string;
            averageScore: number;
            mostAdventurous: boolean;
            category: 'junior' | 'senior';
        }>();

        querySnapshot.docs.forEach(doc => {
            const participant = doc.data() as Participant;
            const teamNumber = participant.teamNumber;

            if (!teamScores.has(teamNumber)) {
                // Initialize team data
                teamScores.set(teamNumber, {
                    teamNumber,
                    teamName: participant.teamName,
                    status: participant.status,
                    averageScore: 0,
                    mostAdventurous: participant.mostAdventurous || false,
                    category: participant.category
                });
            }

            // Calculate average score from all judges
            const scores = participant.judgingScores || [];
            if (scores.length > 0) {
                const totalScore = scores.reduce((sum, score) => {
                    return sum + (
                        (Number(score.criteria1) || 0) +
                        (Number(score.criteria2) || 0) +
                        (Number(score.criteria3) || 0) +
                        (Number(score.criteria4) || 0) +
                        (Number(score.criteria5) || 0)
                    );
                }, 0);
                
                const averageScore = totalScore / (scores.length * 5); // Divide by number of judges * number of criteria
                teamScores.get(teamNumber)!.averageScore = averageScore;
            }
        });

        // Update tables
        const juniorTable = document.getElementById('junior-ranking')?.querySelector('tbody');
        const seniorTable = document.getElementById('senior-ranking')?.querySelector('tbody');

        if (!juniorTable || !seniorTable) {
            console.error('Could not find ranking tables');
            return;
        }

        juniorTable.innerHTML = '';
        seniorTable.innerHTML = '';

        // Convert Map to array and sort by average score
        const sortedTeams = Array.from(teamScores.values())
            .sort((a, b) => b.averageScore - a.averageScore);

        sortedTeams.forEach(team => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${team.teamNumber}</td>
                <td>${team.teamName}</td>
                <td>${team.status}</td>
                <td>${team.averageScore.toFixed(2)}</td>
                <td>${team.mostAdventurous ? 'Yes' : 'No'}</td>
            `;

            if (team.category === 'junior') {
                juniorTable.appendChild(row);
            } else if (team.category === 'senior') {
                seniorTable.appendChild(row);
            }
        });

        console.log('Rankings update complete');
    } catch (error) {
        console.error('Error updating rankings:', error);
    }
}

// Add sorting functionality for ranking tables
function handleRankingSort(event: Event) {
    const header = event.target as HTMLElement;
    if (!header.matches('th.sortable')) return;

    const field = header.getAttribute('data-sort');
    if (!field) return;

    const table = header.closest('table');
    if (!table) return;

    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    const isAsc = !header.classList.contains('asc');

    // Update sort indicators
    table.querySelectorAll('th').forEach(th => {
        th.classList.remove('asc', 'desc');
    });
    header.classList.add(isAsc ? 'asc' : 'desc');

    // Sort rows
    rows.sort((a, b) => {
        const aValue = a.children[getColumnIndex(field)].textContent || '';
        const bValue = b.children[getColumnIndex(field)].textContent || '';

        if (field === 'averageScore') {
            return (parseFloat(aValue) - parseFloat(bValue)) * (isAsc ? 1 : -1);
        }
        return aValue.localeCompare(bValue) * (isAsc ? 1 : -1);
    });

    // Reorder rows
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
}

function getColumnIndex(field: string): number {
    switch (field) {
        case 'teamNumber': return 0;
        case 'teamName': return 1;
        case 'status': return 2;
        case 'averageScore': return 3;
        default: return 0;
    }
}

// Add event listeners for ranking table sorting
document.addEventListener('DOMContentLoaded', () => {
    // ... existing event listeners ...

    // Add ranking table sort listeners
    const rankingTables = ['junior-ranking', 'senior-ranking'];
    rankingTables.forEach(tableId => {
        const table = document.getElementById(tableId);
        if (table) {
            table.querySelectorAll('th.sortable').forEach(header => {
                header.addEventListener('click', handleRankingSort);
            });
        }
    });
}); 