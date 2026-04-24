const cheerio = require('cheerio');

async function testNews() {
  try {
    const res = await fetch('https://news.google.com/rss/search?q=oil+prices+OR+gasoline+prices&hl=en-US&gl=US&ceid=US:en');
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    
    const headlines = [];
    $('item').slice(0, 5).each((i, el) => {
      headlines.push($(el).find('title').text());
    });
    
    console.log('Headlines:', headlines);
  } catch (err) {
    console.error(err);
  }
}

testNews();
