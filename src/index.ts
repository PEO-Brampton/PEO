import './styles.css';
import { db } from './firebase';
import { collection, getDocs, updateDoc, doc, addDoc, query, where, serverTimestamp, orderBy, getDoc } from 'firebase/firestore';
import { Participant, JudgingCriteria, JudgeScore } from './types';

// Constants
const BASE_URL = '/PEO-BBC';

// DOM Elements
const navLinks = document.querySelectorAll('.nav-links a');
const pages = document.querySelectorAll('.page');
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const participantsBody = document.getElementById('participants-body');
const teamSelect = document.getElementById('team-select') as HTMLSelectElement;
const qualificationTeamSelect = document.getElementById('qualification-team-select') as HTMLSelectElement;
const submitButton = document.getElementById('submit-judging') as HTMLButtonElement;
const juniorLeaderboardBody = document.getElementById('junior-leaderboard-body');
const seniorLeaderboardBody = document.getElementById('senior-leaderboard-body');
const csvInput = document.getElementById('csv-input') as HTMLTextAreaElement;
const importCsvButton = document.getElementById('import-csv') as HTMLButtonElement;
const generateTestDataButton = document.getElementById('generate-test-data') as HTMLButtonElement;
const checkInForm = document.getElementById('check-in-form') as HTMLFormElement;
const judgingForm = document.getElementById('judging-form') as HTMLFormElement;
const qualificationForm = document.getElementById('qualification-form') as HTMLFormElement;
const sidebarToggle = document.getElementById('sidebar-toggle') as HTMLButtonElement;
const sidebar = document.querySelector('.sidebar') as HTMLElement;
const waiverModal = document.getElementById('waiver-modal') as HTMLDivElement;
const waiverConfirmBtn = document.getElementById('waiver-confirm') as HTMLButtonElement;
const waiverCancelBtn = document.getElementById('waiver-cancel') as HTMLButtonElement;
const navToggle = document.getElementById('nav-toggle') as HTMLButtonElement;
const navDropdown = document.querySelector('.nav-dropdown') as HTMLElement;

// State
let participants: Participant[] = [];
let isSidebarCollapsed = false;
let currentSort = {
    field: 'teamNumber' as keyof Participant,
    direction: 'asc' as 'asc' | 'desc'
};
let leaderboardSort = {
    junior: {
        field: 'score' as keyof Participant,
        direction: 'desc' as 'asc' | 'desc'
    },
    senior: {
        field: 'score' as keyof Participant,
        direction: 'desc' as 'asc' | 'desc'
    }
};
let sortedParticipantsCache: Participant[] | null = null;
let filteredParticipantsCache: {
    junior: Participant[];
    senior: Participant[];
} | null = null;

// Initial route handling
function handleInitialRoute() {
    const path = window.location.pathname.replace(BASE_URL, '').replace(/^\/+|\/+$/g, '') || 'checkin';
    navigateToPage(path);
}

// Navigation
function navigateToPage(pageId: string) {
    // Validate page ID
    const validPages = ['checkin', 'qualification', 'judging', 'leaderboard', 'admin'];
    if (!validPages.includes(pageId)) {
        pageId = 'checkin'; // Default to check-in page if invalid
    }

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
    window.history.pushState({ pageId }, '', newUrl);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    handleInitialRoute();
    fetchParticipants();
    populateTeamSelect();
});

// Clear cache when participants change
function clearSortCache() {
    sortedParticipantsCache = null;
}

// Make event handlers globally available
declare global {
    interface Window {
        handleCheckIn: (participantId: string) => void;
        handleWaiting: (participantId: string) => void;
        handleReset: (participantId: string) => void;
    }
}

// Navigation
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
window.addEventListener('popstate', (event) => {
    const pageId = event.state?.pageId || 'checkin';
    navigateToPage(pageId);
});

// Sidebar toggle functionality
sidebarToggle?.addEventListener('click', () => {
    isSidebarCollapsed = !isSidebarCollapsed;
    sidebar?.classList.toggle('collapsed');
    
    // Update toggle icon
    const toggleIcon = sidebarToggle.querySelector('.toggle-icon');
    if (toggleIcon) {
        toggleIcon.textContent = isSidebarCollapsed ? '☰' : '×';
    }
});

// Navigation toggle functionality
navToggle?.addEventListener('click', () => {
    navDropdown?.classList.toggle('active');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!navDropdown?.contains(e.target as Node) && 
        !navToggle?.contains(e.target as Node)) {
        navDropdown?.classList.remove('active');
    }
});

// Close dropdown when clicking a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navDropdown?.classList.remove('active');
    });
});

// Firebase Functions
async function fetchParticipants() {
    try {
        const participantsRef = collection(db, 'participants');
        const q = query(participantsRef, orderBy('teamNumber'));
        const querySnapshot = await getDocs(q);
        
        participants = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            judgeScores: doc.data().judgeScores || [] // Ensure judgeScores is initialized
        })) as Participant[];
        
        // Update UI
        renderParticipants(sortParticipants(participants, currentSort.field, currentSort.direction));
        populateTeamSelect();
        updateLeaderboards();
    } catch (error) {
        console.error('Error fetching participants:', error);
        alert('Error fetching participants. Please try again.');
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
            grade: values[4].toString(),
            schoolName: values[5],
            category: values[6] as 'Junior' | 'Senior',
            arrivalTime: values[7],
            waiver: values[8]?.toLowerCase() === 'yes',
            status: 'registered',
            checkedIn: false,
            judged: false,
            judgeScores: []
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
        const grade = (Math.floor(Math.random() * 4) + 5).toString(); // Grades 5-8
        const category = parseInt(grade) <= 6 ? 'Junior' : 'Senior';
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
            waiver: Math.random() > 0.5, // Randomly set waiver status
            status: 'registered',
            checkedIn: false,
            judged: false,
            judgeScores: []
        };
        
        await addDoc(collection(db, 'participants'), participant);
    }
    
    await fetchParticipants();
}

// Sorting Functions
function sortParticipants(participants: Participant[], field: keyof Participant, direction: 'asc' | 'desc'): Participant[] {
    return [...participants].sort((a, b) => {
        let aValue = a[field];
        let bValue = b[field];

        // Handle special cases
        if (field === 'mostAdventurous') {
            aValue = aValue ? 1 : 0;
            bValue = bValue ? 1 : 0;
        }

        // Handle null/undefined values
        if (aValue === undefined || aValue === null) aValue = '';
        if (bValue === undefined || bValue === null) bValue = '';

        // Compare values
        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
    });
}

function updateSortIndicators(isLeaderboard: boolean = false, category?: 'junior' | 'senior') {
    // Remove all sort indicators first
    document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
    });

    if (isLeaderboard && category) {
        const sortState = leaderboardSort[category];
        const table = document.querySelector(`#${category}-leaderboard table`);
        if (!table) return;

        const activeHeader = table.querySelector(`th[data-sort="${sortState.field}"]`);
        if (activeHeader) {
            activeHeader.classList.add(sortState.direction);
        }
    } else {
        const table = document.getElementById('participants-table');
        if (!table) return;

        const activeHeader = table.querySelector(`th[data-sort="${currentSort.field}"]`);
        if (activeHeader) {
            activeHeader.classList.add(currentSort.direction);
        }
    }
}

function handleSort(field: keyof Participant, isLeaderboard: boolean = false, category?: 'junior' | 'senior') {
    if (isLeaderboard && category) {
        const currentSort = leaderboardSort[category];
        leaderboardSort[category] = {
            field,
            direction: currentSort.field === field && currentSort.direction === 'asc' ? 'desc' : 'asc'
        };
        updateLeaderboards();
    } else {
        currentSort = {
            field,
            direction: currentSort.field === field && currentSort.direction === 'asc' ? 'desc' : 'asc'
        };
        renderParticipants(sortParticipants(participants, currentSort.field, currentSort.direction));
    }
}

// Update the updateLeaderboards function to use the correct sort state
function updateLeaderboards() {
    const juniorTable = document.querySelector('#junior-leaderboard table tbody');
    const seniorTable = document.querySelector('#senior-leaderboard table tbody');
    
    if (!juniorTable || !seniorTable) return;

    // Clear existing rows
    juniorTable.innerHTML = '';
    seniorTable.innerHTML = '';

    // Filter participants to only show judged or qualified teams
    const filteredParticipants = participants.filter(p => 
        p.status === 'judged' || p.status === 'qualified'
    );

    // Sort participants based on the current sort field for each category
    const sortedJuniorParticipants = [...filteredParticipants]
        .filter(p => p.category === 'Junior')
        .sort((a, b) => {
            const currentSort = leaderboardSort.junior;
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
                    const aScore = (a.judgeScores || []).length > 0 
                        ? (a.judgeScores || []).reduce((sum, score) => sum + score.criteria1 + score.criteria2 + score.criteria3 + score.criteria4 + score.criteria5, 0) / (a.judgeScores || []).length
                        : 0;
                    const bScore = (b.judgeScores || []).length > 0
                        ? (b.judgeScores || []).reduce((sum, score) => sum + score.criteria1 + score.criteria2 + score.criteria3 + score.criteria4 + score.criteria5, 0) / (b.judgeScores || []).length
                        : 0;
                    comparison = bScore - aScore;
                    break;
                default:
                    comparison = 0;
            }

            return currentSort.direction === 'desc' ? -comparison : comparison;
        });

    const sortedSeniorParticipants = [...filteredParticipants]
        .filter(p => p.category === 'Senior')
        .sort((a, b) => {
            const currentSort = leaderboardSort.senior;
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
                    const aScore = (a.judgeScores || []).length > 0 
                        ? (a.judgeScores || []).reduce((sum, score) => sum + score.criteria1 + score.criteria2 + score.criteria3 + score.criteria4 + score.criteria5, 0) / (a.judgeScores || []).length
                        : 0;
                    const bScore = (b.judgeScores || []).length > 0
                        ? (b.judgeScores || []).reduce((sum, score) => sum + score.criteria1 + score.criteria2 + score.criteria3 + score.criteria4 + score.criteria5, 0) / (b.judgeScores || []).length
                        : 0;
                    comparison = bScore - aScore;
                    break;
                default:
                    comparison = 0;
            }

            return currentSort.direction === 'desc' ? -comparison : comparison;
        });

    // Update junior table
    sortedJuniorParticipants.forEach(participant => {
        const row = document.createElement('tr');
        const averageScore = (participant.judgeScores || []).length > 0
            ? ((participant.judgeScores || []).reduce((sum, score) => sum + score.criteria1 + score.criteria2 + score.criteria3 + score.criteria4 + score.criteria5, 0) / (participant.judgeScores || []).length).toFixed(1)
            : '-';
        const isMostAdventurous = (participant.judgeScores || []).some(score => score.mostAdventurous);
        
        row.innerHTML = `
            <td>${participant.teamNumber}</td>
            <td>${participant.teamName}</td>
            <td>${participant.status}</td>
            <td>${averageScore}</td>
            <td>${isMostAdventurous ? '✓' : ''}</td>
        `;
        juniorTable.appendChild(row);
    });

    // Update senior table
    sortedSeniorParticipants.forEach(participant => {
        const row = document.createElement('tr');
        const averageScore = (participant.judgeScores || []).length > 0
            ? ((participant.judgeScores || []).reduce((sum, score) => sum + score.criteria1 + score.criteria2 + score.criteria3 + score.criteria4 + score.criteria5, 0) / (participant.judgeScores || []).length).toFixed(1)
            : '-';
        const isMostAdventurous = (participant.judgeScores || []).some(score => score.mostAdventurous);
        
        row.innerHTML = `
            <td>${participant.teamNumber}</td>
            <td>${participant.teamName}</td>
            <td>${participant.status}</td>
            <td>${averageScore}</td>
            <td>${isMostAdventurous ? '✓' : ''}</td>
        `;
        seniorTable.appendChild(row);
    });

    // Update sort indicators
    updateSortIndicators(true);
}

// Update the event listeners for sorting
document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
        const field = th.getAttribute('data-sort') as keyof Participant;
        if (!field) return;

        const table = th.closest('table');
        if (!table) return;

        // Determine if this is a leaderboard table
        const isLeaderboard = table.closest('.leaderboard-section') !== null;
        const category = table.closest('#junior-leaderboard') ? 'junior' : 
                        table.closest('#senior-leaderboard') ? 'senior' : undefined;

        handleSort(field, isLeaderboard, category);
    });
});

// Debounce function
function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// UI Functions
function renderParticipants(filteredParticipants: Participant[] = participants) {
    if (!participantsBody) return;
    
    const sortedParticipants = sortParticipants(filteredParticipants, currentSort.field, currentSort.direction);
    const fragment = document.createDocumentFragment();
    
    sortedParticipants.forEach(participant => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${participant.teamNumber}</td>
            <td>${participant.teamName}</td>
            <td>${participant.firstName}</td>
            <td>${participant.lastName}</td>
            <td>${participant.grade}</td>
            <td>${participant.schoolName}</td>
            <td>${participant.category}</td>
            <td>${participant.arrivalTime}</td>
            <td>${participant.waiver ? 'Yes' : 'No'}</td>
            <td>${participant.status}</td>
            <td>
                ${participant.status === 'checked in' ? `
                    <button class="action-button reset-btn" data-participant-id="${participant.id}">
                        Reset
                    </button>
                ` : ''}
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
        `;
        fragment.appendChild(row);
    });

    participantsBody.innerHTML = '';
    participantsBody.appendChild(fragment);

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
    
    // Add event listeners for reset buttons
    participantsBody.querySelectorAll('.reset-btn').forEach(button => {
        button.addEventListener('click', () => {
            const participantId = button.getAttribute('data-participant-id');
            if (participantId) {
                window.handleReset(participantId);
            }
        });
    });
}

// Optimized search with debouncing
const debouncedSearch = debounce((searchTerm: string) => {
    const filteredParticipants = participants.filter(participant => 
        participant.teamNumber.toLowerCase().includes(searchTerm) ||
        participant.teamName.toLowerCase().includes(searchTerm) ||
        participant.firstName.toLowerCase().includes(searchTerm)
    );
    renderParticipants(filteredParticipants);
}, 300);

// Update search event listener
searchInput?.addEventListener('input', (e) => {
    const searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
    debouncedSearch(searchTerm);
});

// Update team select function to handle both qualification and judging forms
function populateTeamSelect() {
    if (!teamSelect || !qualificationTeamSelect) return;
    
    // Clear existing options
    teamSelect.innerHTML = '';
    qualificationTeamSelect.innerHTML = '';
    
    // Create a Map to store unique teams
    const uniqueTeams = new Map<string, Participant>();
    
    // Add default options
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a team';
    teamSelect.appendChild(defaultOption.cloneNode(true));
    qualificationTeamSelect.appendChild(defaultOption.cloneNode(true));
    
    // Add only one entry per team number with appropriate status
    participants.forEach(participant => {
        if (!uniqueTeams.has(participant.teamNumber)) {
            // For judging dropdown, only include checked in, qualified, or judged teams
            if (participant.status === 'checked in' || 
                participant.status === 'qualified' || 
                participant.status === 'judged') {
                uniqueTeams.set(participant.teamNumber, participant);
            }
        }
    });
    
    // Add unique teams to dropdowns
    Array.from(uniqueTeams.values())
        .sort((a, b) => parseInt(a.teamNumber) - parseInt(b.teamNumber))
        .forEach(participant => {
            const option = document.createElement('option');
            option.value = participant.id;
            option.textContent = `Team ${participant.teamNumber} - ${participant.teamName} (${participant.status})`;
            
            // Add to both dropdowns
            teamSelect.appendChild(option.cloneNode(true));
            qualificationTeamSelect.appendChild(option.cloneNode(true));
        });
}

// Event Handlers
let pendingCheckInId: string | null = null;

window.handleCheckIn = function(participantId: string) {
    const participant = participants.find(p => p.id === participantId);
    
    if (participant && participant.waiver === false) {
        // Show custom modal for waiver confirmation
        pendingCheckInId = participantId;
        waiverModal.classList.add('active');
    } else {
        // Normal check-in if waiver is already signed
        updateParticipantStatus(participantId, 'checked in');
    }
};

window.handleWaiting = function(participantId: string) {
    updateParticipantStatus(participantId, 'waiting');
};

window.handleReset = function(participantId: string) {
    updateParticipantStatus(participantId, 'registered');
};

// Waiver modal event listeners
waiverConfirmBtn?.addEventListener('click', () => {
    if (pendingCheckInId) {
        // Update both waiver status and check in status
        updateParticipantWithWaiver(pendingCheckInId, true, 'checked in');
        pendingCheckInId = null;
    }
    waiverModal.classList.remove('active');
});

waiverCancelBtn?.addEventListener('click', () => {
    pendingCheckInId = null;
    waiverModal.classList.remove('active');
});

// New function to update both waiver and status
async function updateParticipantWithWaiver(participantId: string, waiver: boolean, status: 'registered' | 'checked in' | 'waiting' | 'judged') {
    try {
        const participantRef = doc(db, 'participants', participantId);
        
        // Set checkedIn based on status
        const checkedIn = status === 'checked in' || status === 'waiting' || status === 'judged';
        
        // Set arrival time if checking in
        const updateData: any = { 
            status,
            checkedIn,
            waiver
        };
        
        // If changing to checked in, set arrival time
        if (status === 'checked in') {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            updateData.arrivalTime = `${hours}:${minutes}`;
        }
        
        await updateDoc(participantRef, updateData);
        
        // Refresh participants
        await fetchParticipants();
        
        console.log(`Participant ${participantId} waiver and status updated to ${waiver ? 'Yes' : 'No'} and ${status}`);
    } catch (error) {
        console.error(`Error updating participant: ${error}`);
        alert(`Error updating participant: ${error}`);
    }
}

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

// Form validation helper
function validateForm(formData: FormData, isQualification: boolean = false): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate required fields
    const requiredFields = isQualification ? ['qualification-team-select'] : ['team-select'];
    
    requiredFields.forEach(field => {
        if (!formData.get(field)) {
            errors.push(`${field.replace('-', ' ')} is required`);
        }
    });
    
    // Validate criteria scores for judging
    if (!isQualification) {
        const criteriaScores = document.querySelectorAll('.criteria-score');
        criteriaScores.forEach((select, index) => {
            const value = (select as HTMLSelectElement).value;
            if (!value || isNaN(Number(value)) || Number(value) < 0 || Number(value) > 10) {
                errors.push(`Criteria ${index + 1} must be a number between 0 and 10`);
            }
        });
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
}

// Optimized form submission handler
judgingForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const formData = new FormData(judgingForm);
        const validation = validateForm(formData);
        
        if (!validation.isValid) {
            alert(validation.errors.join('\n'));
            return;
        }

        const selectedTeamId = formData.get('team-select') as string;
        const judgeId = formData.get('judge-select') as string;
        
        // Create the judge's score object
        const judgeScore: JudgeScore = {
            judgeId,
            criteria1: parseInt(formData.get('criteria1') as string),
            criteria2: parseInt(formData.get('criteria2') as string),
            criteria3: parseInt(formData.get('criteria3') as string),
            criteria4: parseInt(formData.get('criteria4') as string),
            criteria5: parseInt(formData.get('criteria5') as string),
            comments: formData.get('judge-comments') as string,
            mostAdventurous: formData.get('most-adventurous') === 'on'
        };

        const participantRef = doc(db, 'participants', selectedTeamId);
        const participantDoc = await getDoc(participantRef);
        const participant = participantDoc.data() as Participant;

        // Update or add the judge's score
        let judgeScores = participant.judgeScores || [];
        const existingScoreIndex = judgeScores.findIndex(s => s.judgeId === judgeId);
        
        if (existingScoreIndex >= 0) {
            // Update existing score
            judgeScores[existingScoreIndex] = judgeScore;
        } else {
            // Add new score
            judgeScores.push(judgeScore);
        }

        // Calculate average score
        const totalScore = judgeScores.reduce((sum, score) => {
            return sum + (
                score.criteria1 + 
                score.criteria2 + 
                score.criteria3 + 
                score.criteria4 + 
                score.criteria5
            );
        }, 0);
        const averageScore = totalScore / (judgeScores.length * 5); // 5 criteria per judge

        // Determine if team is most adventurous (if any judge marks it)
        const isMostAdventurous = judgeScores.some(score => score.mostAdventurous);

        // Update participant document
        await updateDoc(participantRef, {
            judgeScores,
            score: averageScore,
            mostAdventurous: isMostAdventurous,
            status: 'judged'
        });

        // Reset form and refresh data
        judgingForm.reset();
        await fetchParticipants();
        alert('Score submitted successfully!');
    } catch (error) {
        console.error('Error submitting score:', error);
        alert('Error submitting score. Please try again.');
    }
});

// Add qualification form submission handler
qualificationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const formData = new FormData(qualificationForm);
        const validation = validateForm(formData, true);
        
        if (!validation.isValid) {
            alert(validation.errors.join('\n'));
            return;
        }

        const selectedTeamId = formData.get('qualification-team-select') as string;
        const bridgeWeightQualified = formData.get('bridge-weight') === 'on';
        const bridgeLengthQualified = formData.get('bridge-weight-supported') === 'on';

        const participantRef = doc(db, 'participants', selectedTeamId);
        
        // Only update qualification fields, preserve existing status
        await updateDoc(participantRef, {
            bridgeWeightQualified,
            bridgeLengthQualified,
            qualified: bridgeWeightQualified && bridgeLengthQualified
        });

        // Reset form and refresh data
        qualificationForm.reset();
        await fetchParticipants();
        alert('Qualification updated successfully!');
    } catch (error) {
        console.error('Error updating qualification:', error);
        alert('Error updating qualification. Please try again.');
    }
});

// Initialize
fetchParticipants(); 