import fetch from 'node-fetch';
import cheerio from 'cheerio';

const url = 'http://www.imdb.com/title/tt1229340/';

(async () => {
    const html = await (await fetch(url)).text();
    const $ = cheerio.load(html);
    const json = { title: '', release: '', rating: '' };
    console.log($('.header').text());
})();
