export interface Participant {
    id: string;
    teamNumber: string;
    teamName: string;
    firstName: string;
    lastName: string;
    grade: string;
    schoolName: string;
    category: 'Junior' | 'Senior';
    arrivalTime: string;
    checkedIn: boolean;
    checkedInAt?: Date;
    judged: boolean;
    judgedAt?: Date;
    bridgeWeight?: number;
    bridgeWeightSupported?: number;
    judgeComments?: string;
    mostAdventurous?: boolean;
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