import './styles.css';
import { db } from './firebase';
import { collection, getDocs, updateDoc, doc, addDoc, query, where } from 'firebase/firestore';
import { Participant, JudgingCriteria } from './types';

// Constants
const BASE_URL = '/PEO';

// DOM Elements
const navLinks = document.querySelectorAll('.nav-links a');
const pages = document.querySelectorAll('.page');
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const participantsBody = document.getElementById('participants-body');
const teamSelect = document.getElementById('team-select') as HTMLSelectElement;
const submitButton = document.getElementById('submit-judging') as HTMLButtonElement;
const juniorLeaderboardBody = document.getElementById('junior-leaderboard-body');
const seniorLeaderboardBody = document.getElementById('senior-leaderboard-body');
const csvInput = document.getElementById('csv-input') as HTMLTextAreaElement;
const importCsvButton = document.getElementById('import-csv') as HTMLButtonElement;
const generateTestDataButton = document.getElementById('generate-test-data') as HTMLButtonElement;

// State
let participants: Participant[] = [];

// Make event handlers globally available
declare global {
    interface Window {
        handleCheckIn: (participantId: string) => void;
        handleWaiting: (participantId: string) => void;
    }
}

// Navigation
function navigateToPage(pageId: string) {
    // Update active states
    navLinks.forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector(`[data-page="${pageId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
    
    // Show selected page
    pages.forEach(page => {
        page.classList.remove('active');
        if (page.id === `${pageId}-page`) {
            page.classList.add('active');
        }
    });

    // Update URL without page reload
    const newUrl = `${BASE_URL}/${pageId}`;
    window.history.pushState({}, '', newUrl);
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetPage = link.getAttribute('data-page');
        if (targetPage) {
            navigateToPage(targetPage);
        }
    });
});

// Handle browser back/forward buttons
window.addEventListener('popstate', () => {
    const path = window.location.pathname.replace(BASE_URL, '').replace('/', '') || 'checkin';
    navigateToPage(path);
});

// Firebase Functions
async function fetchParticipants() {
    try {
        console.log('Fetching participants...');
        const querySnapshot = await getDocs(collection(db, 'participants'));
        console.log('Query snapshot received:', querySnapshot.size, 'documents');
        
        participants = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Participant[];
        
        console.log('Participants loaded:', participants.length);
        renderParticipants();
        updateTeamSelect();
        updateLeaderboards();
    } catch (error: any) {
        console.error('Error fetching participants:', error);
        if (error.code === 'unavailable') {
            alert('You are currently offline. The app will work in offline mode. Changes will sync when you reconnect.');
        } else if (error.code === 'not-found') {
            console.log('No participants found in the database');
            participants = [];
            renderParticipants();
            updateTeamSelect();
            updateLeaderboards();
        } else if (error.code === 'permission-denied') {
            console.error('Permission denied error:', error);
            alert('Access denied. Please check your Firebase security rules.');
        } else {
            console.error('Unknown error:', error);
            alert('Error loading participants. Please check your connection and try again.');
        }
    }
}

async function updateParticipantStatus(participantId: string, status: Participant['status']) {
    try {
        const participantRef = doc(db, 'participants', participantId);
        await updateDoc(participantRef, { status });
        await fetchParticipants();
    } catch (error: any) {
        console.error('Error updating participant status:', error);
        if (error.code === 'unavailable') {
            alert('You are currently offline. Changes will sync when you reconnect.');
        } else if (error.code === 'permission-denied') {
            alert('Access denied. Please check your Firebase security rules.');
        } else {
            alert('Error updating status. Please try again.');
        }
    }
}

async function submitJudging(participantId: string, criteria: JudgingCriteria, comments: string) {
    try {
        const participantRef = doc(db, 'participants', participantId);
        const totalScore = Object.values(criteria).reduce((sum, score) => sum + score, 0);
        
        await updateDoc(participantRef, {
            status: 'judged',
            score: totalScore,
            comments,
            ...criteria
        });
        
        await fetchParticipants();
    } catch (error: any) {
        console.error('Error submitting judging:', error);
        if (error.code === 'unavailable') {
            alert('You are currently offline. Changes will sync when you reconnect.');
        } else if (error.code === 'permission-denied') {
            alert('Access denied. Please check your Firebase security rules.');
        } else {
            alert('Error submitting judging. Please try again.');
        }
    }
}

async function importParticipants(csvData: string) {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',');
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const participant: Omit<Participant, 'id'> = {
            teamNumber: values[0],
            teamName: values[1],
            firstName: values[2],
            lastName: values[3],
            grade: parseInt(values[4]),
            schoolName: values[5],
            category: values[6] as 'Junior' | 'Senior',
            arrivalTime: values[7],
            status: 'registered'
        };
        
        await addDoc(collection(db, 'participants'), participant);
    }
    
    await fetchParticipants();
}

async function generateRandomParticipants() {
    const schools = ['High School A', 'High School B', 'High School C', 'Middle School X', 'Middle School Y'];
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emma', 'James', 'Olivia', 'William', 'Sophia'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    
    for (let i = 0; i < 50; i++) {
        const teamNumber = String(i + 1).padStart(4, '0');
        const grade = Math.floor(Math.random() * 4) + 5; // Grades 5-8
        const category = grade <= 6 ? 'Junior' : 'Senior';
        const hour = Math.floor(Math.random() * 4) + 8; // 8 AM to 12 PM
        const minute = Math.floor(Math.random() * 60);
        const arrivalTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        const participant: Omit<Participant, 'id'> = {
            teamNumber,
            teamName: `Team ${String.fromCharCode(65 + (i % 26))}${Math.floor(i / 26) + 1}`,
            firstName: firstNames[Math.floor(Math.random() * firstNames.length)],
            lastName: lastNames[Math.floor(Math.random() * lastNames.length)],
            grade,
            schoolName: schools[Math.floor(Math.random() * schools.length)],
            category,
            arrivalTime,
            status: 'registered'
        };
        
        await addDoc(collection(db, 'participants'), participant);
    }
    
    await fetchParticipants();
}

// UI Functions
function renderParticipants(filteredParticipants: Participant[] = participants) {
    if (!participantsBody) return;
    
    participantsBody.innerHTML = filteredParticipants.map(participant => `
        <tr>
            <td>${participant.teamNumber}</td>
            <td>${participant.teamName}</td>
            <td>${participant.firstName}</td>
            <td>${participant.lastName}</td>
            <td>${participant.grade}</td>
            <td>${participant.schoolName}</td>
            <td>${participant.category}</td>
            <td>${participant.arrivalTime}</td>
            <td>${participant.status}</td>
            <td>
                ${(participant.status === 'registered' || participant.status === 'waiting') ? `
                    <button class="action-button check-in-btn" data-participant-id="${participant.id}">
                        Check In
                    </button>
                ` : ''}
                ${participant.status === 'registered' ? `
                    <button class="action-button waiting-btn" data-participant-id="${participant.id}">
                        Waiting
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');

    // Add event listeners to the buttons
    participantsBody.querySelectorAll('.check-in-btn').forEach(button => {
        button.addEventListener('click', () => {
            const participantId = button.getAttribute('data-participant-id');
            if (participantId) {
                window.handleCheckIn(participantId);
            }
        });
    });

    participantsBody.querySelectorAll('.waiting-btn').forEach(button => {
        button.addEventListener('click', () => {
            const participantId = button.getAttribute('data-participant-id');
            if (participantId) {
                window.handleWaiting(participantId);
            }
        });
    });
}

function updateTeamSelect() {
    if (!teamSelect) return;
    
    const checkedInTeams = participants.filter(p => p.status === 'checked in');
    teamSelect.innerHTML = `
        <option value="">Select a Team</option>
        ${checkedInTeams.map(team => `
            <option value="${team.id}">${team.teamNumber} - ${team.teamName}</option>
        `).join('')}
    `;
}

function updateLeaderboards() {
    if (!juniorLeaderboardBody || !seniorLeaderboardBody) return;
    
    const judgedParticipants = participants.filter(p => p.status === 'judged');
    
    // Sort participants by score in descending order
    const sortedParticipants = [...judgedParticipants].sort((a, b) => {
        const scoreA = a.score || 0;
        const scoreB = b.score || 0;
        return scoreB - scoreA; // Descending order
    });
    
    const juniorTeams = sortedParticipants.filter(p => p.category === 'Junior');
    const seniorTeams = sortedParticipants.filter(p => p.category === 'Senior');
    
    juniorLeaderboardBody.innerHTML = juniorTeams.map(team => `
        <tr>
            <td>${team.teamNumber}</td>
            <td>${team.teamName}</td>
            <td>${team.category}</td>
            <td>${team.status}</td>
            <td>${team.score}</td>
        </tr>
    `).join('');
    
    seniorLeaderboardBody.innerHTML = seniorTeams.map(team => `
        <tr>
            <td>${team.teamNumber}</td>
            <td>${team.teamName}</td>
            <td>${team.category}</td>
            <td>${team.status}</td>
            <td>${team.score}</td>
        </tr>
    `).join('');
}

// Event Handlers
window.handleCheckIn = function(participantId: string) {
    updateParticipantStatus(participantId, 'checked in');
};

window.handleWaiting = function(participantId: string) {
    updateParticipantStatus(participantId, 'waiting');
};

// Search functionality
searchInput?.addEventListener('input', (e) => {
    const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
    const filteredParticipants = participants.filter(participant => 
        participant.teamNumber.toLowerCase().includes(searchTerm) ||
        participant.teamName.toLowerCase().includes(searchTerm) ||
        participant.firstName.toLowerCase().includes(searchTerm)
    );
    renderParticipants(filteredParticipants);
});

// Judging form submission
submitButton?.addEventListener('click', async () => {
    try {
        const selectedTeamId = teamSelect?.value;
        if (!selectedTeamId) {
            alert('Please select a team to judge.');
            return;
        }
        
        // Get all criteria scores
        const criteriaScores = document.querySelectorAll('.criteria-score');
        if (criteriaScores.length !== 5) {
            alert('Error: Missing criteria scores. Please check the form.');
            return;
        }

        const criteria: JudgingCriteria = {
            criteria1: Number((criteriaScores[0] as HTMLSelectElement)?.value || 0),
            criteria2: Number((criteriaScores[1] as HTMLSelectElement)?.value || 0),
            criteria3: Number((criteriaScores[2] as HTMLSelectElement)?.value || 0),
            criteria4: Number((criteriaScores[3] as HTMLSelectElement)?.value || 0),
            criteria5: Number((criteriaScores[4] as HTMLSelectElement)?.value || 0)
        };

        // Validate criteria scores
        if (Object.values(criteria).some(score => isNaN(score) || score < 0 || score > 10)) {
            alert('Please enter valid scores between 0 and 10 for all criteria.');
            return;
        }
        
        const commentsElement = document.getElementById('judge-comments') as HTMLTextAreaElement;
        const comments = commentsElement?.value || '';
        
        await submitJudging(selectedTeamId, criteria, comments);
        
        // Reset form
        if (teamSelect) teamSelect.value = '';
        criteriaScores.forEach(select => {
            if (select instanceof HTMLSelectElement) {
                select.value = '';
            }
        });
        if (commentsElement) commentsElement.value = '';
        
        alert('Judging submitted successfully!');
    } catch (error) {
        console.error('Error submitting judging:', error);
        alert('Error submitting judging. Please try again.');
    }
});

// Admin functionality
importCsvButton?.addEventListener('click', async () => {
    if (!csvInput?.value.trim()) return;
    try {
        await importParticipants(csvInput.value);
        csvInput.value = '';
        alert('Participants imported successfully!');
    } catch (error) {
        console.error('Error importing participants:', error);
        alert('Error importing participants. Please check the CSV format.');
    }
});

generateTestDataButton?.addEventListener('click', async () => {
    try {
        await generateRandomParticipants();
        alert('Test data generated successfully!');
    } catch (error) {
        console.error('Error generating test data:', error);
        alert('Error generating test data.');
    }
});

// Initialize
fetchParticipants(); 