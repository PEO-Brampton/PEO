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
    status: 'registered' | 'checked in' | 'waiting' | 'qualified' | 'judged';
    checkedIn: boolean;
    checkedInAt?: Date;
    judged: boolean;
    judgedAt?: Date;
    waiver?: boolean;
    judgeScores: JudgeScore[];
    qualified?: boolean;
    criteria1?: number;
    criteria2?: number;
    criteria3?: number;
    criteria4?: number;
    criteria5?: number;
    mostAdventurous?: boolean;
    score?: number;
}

export interface JudgingCriteria {
    criteria1: number;
    criteria2: number;
    criteria3: number;
    criteria4: number;
    criteria5: number;
}

export interface JudgeScore {
    judgeId: string;
    criteria1: number;
    criteria2: number;
    criteria3: number;
    criteria4: number;
    criteria5: number;
    comments: string;
    mostAdventurous: boolean;
} 