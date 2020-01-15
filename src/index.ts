import fetch from 'node-fetch';
import cheerio from 'cheerio';
import md5 from 'md5';
import fs from 'fs';
import shell from 'shelljs';
import { Branches, Exams, Subjects, SingleSubjectResult, BranchResult } from './types';

const dataDirectory = 'data';

shell.mkdir('-p', dataDirectory);

const getExamListUri = () => 'https://result.smuexam.in/result/v1/index.php';
const getSubjectListUri = (examId: string) => `https://result.smuexam.in/result/v1/${examId}.php`;
const getResultListUri = (subjectId: string) => `https://result.smuexam.in/result/v1/grade.php?subid=${subjectId}`;

const getSingleSubjectResult = async (examId: string, subjectId: string): Promise<SingleSubjectResult> => {
    console.log(examId, subjectId);
    const req = await fetch(getSubjectListUri(examId));
    const cookieString = req.headers.get('set-cookie');
    if (!cookieString) throw new Error('Set-Cookie not received');
    const html = await (
        await fetch(getResultListUri(subjectId), {
            headers: {
                cookie: cookieString,
            },
        })
    ).text();

    const results: SingleSubjectResult = {};
    const $ = cheerio.load(html);
    $('pre', '#portfolio')
        .children()
        .html()
        ?.split('<br>')
        .map((row) => {
            row = row.trim();
            row = row.replace(/ /g, '');
            return row.split('\t');
        })
        .filter((resultCols) => resultCols.length === 5)
        .map((result) => {
            results[result[0]] = result.slice(1);
        });
    return results;
};

const getBranchResults = async (examId: string, subjectIds: string[]): Promise<BranchResult> => {
    const results: BranchResult = {};
    subjectIds.map(async (subjectId) => {
        const subjectResult = await getSingleSubjectResult(examId, subjectId);
        Object.keys(subjectResult).map((regId) => {
            if (!(regId in results)) results[regId] = {};
            results[regId][subjectId] = subjectResult[regId];
        });
    });
    return results;
};

const getBranches = async (examId: string): Promise<Branches> => {
    const html = await (await fetch(getSubjectListUri(examId))).text();
    const $ = cheerio.load(html);
    const branchSelectors = $('.card').toArray();
    const branches: Branches = {};
    await Promise.all(
        branchSelectors.map(async (branchSelector) => {
            const header = $('.card-header', branchSelector);
            const branchTitle = $('h5', header);
            const branchName = branchTitle.text().trim();
            const branchId = md5(branchName);

            const body = $('.card-body', branchSelector);
            const subjectSelector = $('a', body).toArray();
            const subjects: Subjects = {};

            await Promise.all(
                subjectSelector.map(async (subject) => {
                    const selector = $(subject);
                    const attributes = selector.attr();
                    const href = attributes['href'];
                    const subjectId = href.split('subid=')[1];
                    const subjectName = selector
                        .text()
                        .replace(`${subjectId} - `, '')
                        .replace(`${subjectId}- `, '')
                        .replace(`${subjectId} -`, '')
                        .replace(`${subjectId}-`, '');
                    subjects[subjectId] = subjectName;
                }),
            );

            const results: BranchResult = await getBranchResults(examId, Object.keys(subjects));

            branches[branchId] = {
                name: branchName,
                subjects: subjects,
                results: results,
            };
        }),
    );
    return branches;
};

const fetchExams = async (): Promise<Exams> => {
    const examListUri = getExamListUri();
    // const baseUrl = examListUri.split('/').slice(0, -1).join('/');
    const html = await (await fetch(examListUri)).text();
    const $ = cheerio.load(html);
    const examSelector = $('li', '#collapseTwo');
    const exams: Exams = {};
    await Promise.all(
        examSelector.toArray().map(async (e) => {
            const examAnchor = $('a', e);
            const examAttributes = examAnchor.attr();
            const examName = examAnchor.text();
            const href = examAttributes.href;
            const examId = href.split('.php')[0];
            const branches = await getBranches(examId);
            exams[examId] = { name: examName, branches: branches };
        }),
    );
    return exams;
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
    // Fetch and update exam list
    const exams = await fetchExams();
    console.log(exams['ex19'].branches!['36ecbfbc214c4085ca19c83f339c5763']['results']);
    //const oldExamList = await fetchJsonFile(dataDirectory + '/exams.json');
    //const newHash = md5(JSON.stringify(newExamList));
    //const oldHash = md5(JSON.stringify(oldExamList));
    //if (newHash !== oldHash) await saveJsonFile(dataDirectory + '/exams.json', newExamList);
    // Fetch subjects
    // await Promise.all(Object.keys(newExamList).map(async (examId) => await fetchBranchAndSubject(examId)));
    // Fetch results
    //console.log(examSubjects[0].branches);
    // const result = await getResults('ex21', 'CS1875');
    // console.log(result);
})();
