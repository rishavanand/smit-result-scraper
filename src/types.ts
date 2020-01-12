export type Branch = {
    id?: string;
    name?: string;
};

export type Exam = {
    name?: string;
    id?: string;
    link?: string;
    branches?: Branch[];
};

export type ExamList = {
    createdAt?: string;
    updatedAt?: string;
    checkedAt?: string;
    exams?: Exam[];
    lastContentHash?: string;
};
