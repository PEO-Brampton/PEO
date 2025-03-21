export interface Participant {
    id: string;
    teamNumber: string;
    teamName: string;
    firstName: string;
    lastName: string;
    grade: number;
    schoolName: string;
    category: 'Junior' | 'Senior';
    arrivalTime: string;
    status: 'registered' | 'checked in' | 'waiting' | 'judged';
    score?: number;
    comments?: string;
}

export interface JudgingCriteria {
    criteria1: number;
    criteria2: number;
    criteria3: number;
    criteria4: number;
    criteria5: number;
} 