import fetch from 'node-fetch';
import cheerio from 'cheerio';
import md5 from 'md5';

const examListUri = 'https://result.smuexam.in/result/v1/index.php';

const getBranches = async (examUri: string) => {
    const html = await (await fetch(examUri)).text();
    const $ = cheerio.load(html);
    const branches = await Promise.all(
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

const fetchExams = async (examListUri: string) => {
    const exams: { name?: string }[] = [];
    const baseUrl = examListUri.split('/').slice(0, -1).join('/');
    const html = await (await fetch(examListUri)).text();
    const $ = cheerio.load(html);
    await Promise.all(
        $('li', '#collapseTwo')
            .toArray()
            .map(async (e) => {
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
                exams.push(exam);
            }),
    );
    return exams;
};

(async () => {
    const exams = await fetchExams(examListUri);
    console.log(exams[0]);
})();
