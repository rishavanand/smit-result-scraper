import fetch from 'node-fetch';
import cheerio from 'cheerio';
import md5 from 'md5';
import fs from 'fs';
import shell from 'shelljs';
import { Branches, Branch, Exams, Subjects, SingleSubjectResult, BranchResult } from './types';

const dataDirectory = 'data';
let examCookie: string;
const getExamListUri = () => 'https://result.smuexam.in/result/v1/index.php';
const getSubjectListUri = (examId: string) => `https://result.smuexam.in/result/v1/${examId}.php`;
const getResultListUri = (subjectId: string) => `https://result.smuexam.in/result/v1/grade.php?subid=${subjectId}`;

// Ensure data director is available
shell.mkdir('-p', dataDirectory);

/**
 * Delays function execution
 * @param seconds Seconds to wait for
 */
const wait = async (seconds: number) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            return resolve();
        }, seconds * 1000);
    });
};

/**
 * Changes and returns PHPSESSID for target exam
 * This is supposed to work on for sequential use
 * For parallel use a local variable
 * @param examId Target exam ID
 */
const getExamCookie = async (examId: string) => {
    console.log('Fetching cookie for examId: ' + examId);
    if (!examCookie) {
        const req = await fetch(getSubjectListUri(examId));
        const cookie = req.headers.get('set-cookie');
        if (!cookie) throw new Error('Set-Cookie not received');
        examCookie = cookie;
    } else {
        await fetch(getSubjectListUri(examId), {
            method: 'GET',
            headers: {
                cookie: examCookie,
            },
        });
    }
    return examCookie;
};

/**
 * Fetches results for a given subject
 * @param subjectId Target subject ID
 * @param cookie Target exam session
 */
const getSingleSubjectResult = async (subjectId: string, cookie: string): Promise<SingleSubjectResult> => {
    const html = await (
        await fetch(getResultListUri(subjectId), {
            headers: {
                cookie: cookie,
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

/**
 * Scrapes all results for a given branch based based on subjects belonging to the target branch
 * @param branch Target branch object
 * @param cookie Target exam session
 */
const getBranchResults = async (branch: Branch, cookie: string): Promise<BranchResult> => {
    const results: BranchResult = {};
    const subjectIds = Object.keys(branch.subjects!);

    await subjectIds.reduce(async (previousPromise, subjectId) => {
        await previousPromise;
        console.log('Fetching Subject : ' + subjectId);
        const subjectResult = await getSingleSubjectResult(subjectId, cookie);
        await Object.keys(subjectResult).map((regId) => {
            if (!(regId in results)) results[regId] = {};
            results[regId][subjectId] = subjectResult[regId];
        });
    }, Promise.resolve());

    return results;
};

/**
 * Scrapes list of branches and corresponding subjects for a given exam
 * @param examId Target exam ID. Example: ex21
 */
const getBranchesAndSubjects = async (examId: string): Promise<Branches> => {
    const html = await (await fetch(getSubjectListUri(examId))).text();
    const $ = cheerio.load(html);
    const branchSelectors = $('.card').toArray();
    const branches: Branches = {};

    await Promise.all(
        await branchSelectors.map(async (branchSelector) => {
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
                    let href = attributes['href'];
                    if (!href.includes('?')) href = 'grade.php?' + href.split('grade.php')[1];
                    const subjectId = href.split('?')[1].split('&')[0].split('subid=')[1];
                    const subjectName = selector
                        .text()
                        .replace(`${subjectId} - `, '')
                        .replace(`${subjectId}- `, '')
                        .replace(`${subjectId} -`, '')
                        .replace(`${subjectId}-`, '');
                    if (subjectId) subjects[subjectId] = subjectName.trim();
                }),
            );

            branches[branchId] = {
                name: branchName.trim(),
                subjects: subjects,
            };
        }),
    );

    return branches;
};

/**
 * Scrapes list of exams
 */
const fetchExams = async (): Promise<Exams> => {
    const examListUri = getExamListUri();
    const html = await (await fetch(examListUri)).text();
    const $ = cheerio.load(html);
    const examSelector = $('li', '#collapseTwo');
    const exams: Exams = {};

    examSelector.toArray().map(async (e) => {
        const examAnchor = $('a', e);
        const examAttributes = examAnchor.attr();
        const examName = examAnchor.text();
        const href = examAttributes.href;
        const examId = href.split('.php')[0];
        exams[examId] = { name: examName };
    });

    return exams;
};

/**
 * Scrapes results of all exams
 */
const scrape = async (): Promise<Exams> => {
    // Fetch exam list
    const exams = await fetchExams();
    const examIds = Object.keys(exams);

    await wait(30);

    // Fetch branches for each exam serially
    await examIds.reduce(async (lastPromise, examId) => {
        await lastPromise;
        console.log('Fetching subjects for exam : ' + examId);
        const branches = await getBranchesAndSubjects(examId);
        exams[examId]['branches'] = branches;
    }, Promise.resolve());

    await wait(30);

    // Fetch results for each exam serially
    await examIds.reduce(async (lastPromise, examId) => {
        await lastPromise;
        await wait(30);

        const cookieString = await getExamCookie(examId);
        const branchIds = Object.keys(exams[examId].branches!);

        // Fetch results for all branch simultaneously
        await Promise.all(
            branchIds.map(async (branchId) => {
                const results = await getBranchResults(exams[examId]['branches']![branchId], cookieString);
                exams[examId]['branches']![branchId]['results'] = results;
            }),
        );
    }, Promise.resolve());

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
    const exams = await scrape();
    //console.log(exams['ex19'].branches!['36ecbfbc214c4085ca19c83f339c5763']['results']);
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
