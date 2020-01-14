export type SingleSubjectResult = {
    [regId: string]: string[];
};

export type BranchResult = {
    [regId: string]: { [subId: string]: string[] };
};

export type Subjects = {
    [id: string]: string;
};

export type Branches = {
    [id: string]: {
        name?: string;
        subjects?: Subjects;
        results?: BranchResult;
    };
};

export type Exams = {
    [id: string]: {
        name?: string;
        branches?: Branches;
    };
};
