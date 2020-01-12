import fetch from 'node-fetch';
import cheerio from 'cheerio';
import md5 from 'md5';
import fs from 'fs';
import shell from 'shelljs';
import { Branch, Exam, ExamList } from './types';

const examListUri = 'https://result.smuexam.in/result/v1/index.php';
const dataDirectory = 'data';

shell.mkdir('-p', dataDirectory);

const getBranches = async (examUri: string): Promise<Branch[]> => {
    const html = await (await fetch(examUri)).text();
    const $ = cheerio.load(html);
    const branches: Branch[] = await Promise.all(
        $('h5', '.card-header')
            .toArray()
            .map((e) => {
                const branchAnchor = $(e);
                const branchName = branchAnchor.text().trim();
                const branchId = md5(branchName);
                return {
                    id: branchId,
                    name: branchName,
                };
            }),
    );
    return branches;
};

const fetchCurrentExamListHash = async (examListUri: string): Promise<string> => {
    const html = await (await fetch(examListUri)).text();
    const $ = cheerio.load(html);
    const examSelector = $('li', '#collapseTwo');
    const contentHash = md5(examSelector.text());
    return contentHash;
};

const fetchExams = async (examListUri: string): Promise<ExamList> => {
    const baseUrl = examListUri.split('/').slice(0, -1).join('/');
    const html = await (await fetch(examListUri)).text();
    const $ = cheerio.load(html);
    const examSelector = $('li', '#collapseTwo');
    const lastContentHash = await fetchCurrentExamListHash(examListUri);
    const exams: Exam[] = await Promise.all(
        examSelector.toArray().map(async (e) => {
            const examAnchor = $('a', e);
            const examAttributes = examAnchor.attr();
            const href = examAttributes.href;
            const examId = href.split('.php')[0];
            const examUri = encodeURI(baseUrl + '/' + href);
            const branches = await getBranches(examUri);
            const exam = {
                id: examId,
                name: examAnchor.text(),
                link: examUri,
                branches: branches,
            };
            return exam;
        }),
    );
    const examList: ExamList = {
        exams: exams,
        lastContentHash: lastContentHash,
    };
    return examList;
};

const fetchJsonFile = <T>(filePath: string): Promise<T> => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) return reject(err);
            try {
                const dataString = data.toString();
                const jsonData: T = JSON.parse(dataString);
                return resolve(jsonData);
            } catch (err) {
                return reject(err);
            }
        });
    });
};

const saveJsonFile = <T>(filePath: string, jsonData: T): Promise<void> => {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, JSON.stringify(jsonData), (err) => {
            if (err) return reject(err);
            return resolve();
        });
    });
};

(async () => {
    let examList: ExamList;
    try {
        examList = await fetchJsonFile(dataDirectory + '/exams.json');
    } catch (err) {
        examList = {};
        await saveJsonFile(dataDirectory + '/exams.json', examList);
    }

    const newExamListHash = await fetchCurrentExamListHash(examListUri);

    if (newExamListHash === examList.lastContentHash) console.log('Exam list is already updated');
    else {
        console.log('Updating exam list');
        const newExamList = await fetchExams(examListUri);
        if (!newExamList.exams?.length) throw new Error('Exam list is empty');
        await saveJsonFile(dataDirectory + '/exams.json', newExamList);
        console.log('Exam list updated successfully');
    }
})();
