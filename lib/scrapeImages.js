'use strict'

const crypto = require('crypto');
const fs = require('fs');

const puppeteer = require('puppeteer');
const download = require('image-downloader');
const imageType = require('image-type');
const ProgressBar = require('progress');


const scrapeImages = async ({term, lang = 'en', engine = 'yandex', target = 3000}) => {
  const browser = await puppeteer.launch({
    //headless: false,
    args: ['--fast-start', '--disable-extensions', '--no-sandbox', '--disable-setuid-sandbox']
  });

  const [page] = await browser.pages();
  await page.setViewport({width: 1280, height: 926});

  let translated_term = term;
  if (lang !== 'en') {
    const data = JSON.parse(await fs.promises.readFile('./data.json', 'utf8'));
    const translations = data['translations'];
    if (term in translations && lang in translations[term]) {
      translated_term = translations[term][lang];
    } else {
      throw `term ${term} does not have a translation for language ${lang}: update data.json to include one.`;
    }
  }

  let encodedUrl;
  let selector;
  let selectorsToImageUrlConverter;
  let moreResultsButtonSelector;
  switch (engine) {
    case 'duckduckgo':
      encodedUrl = text => `https://duckduckgo.com/?q=${text.replace(' ', '+')}&t=h_&iax=images&ia=images`;
      selector = '.tile--img__img';
      selectorsToImageUrlConverter = items => items.map(item => item.src);
      break;
    case 'yandex':
      encodedUrl = text => `https://yandex.com/images/search?text=${encodeURIComponent('"' + text + '"')}`;
      selector = '.serp-item';
      selectorsToImageUrlConverter = items => items.map(item => JSON.parse(item.getAttribute('data-bem'))["serp-item"]["img_href"]);
      break;
    case 'infospace':
      encodedUrl = text => `https://search.infospace.com/serp?qc=images&q=${text.replace(' ', '+')}`;
      selector = 'img';
      selectorsToImageUrlConverter = items => items.map(item => item.src);
      moreResultsButtonSelector = 'a.pagination__num.next';
      // problem here is that pressing the button navigates to another page instead of loading more images on the same page like bing
      // so the button pressing logic would need to be made more complicated to handle both cases
      throw 'infospace not fully implemented (have to work out the next button still)!';
      break;
    case 'bing':
      encodedUrl = text => `https://www.bing.com/images/search?q=${text.replace(' ', '+')}`;
      selector = '.mimg';
      selectorsToImageUrlConverter = items => items.map(item => item.src);
      moreResultsButtonSelector = 'a.btn_seemore';
      break;
    case 'google':
      encodedUrl = text => `https://www.google.co.in/search?q=${encodeURIComponent('"' + text + '"')}&source=lnms&tbm=isch`
      selector = 'img.rg_i';
      selectorsToImageUrlConverter = items => items.map(item => item.src);
      break;
    case 'instagram':
      encodedUrl = text => `https://www.instagram.com/explore/tags/${text.replace(' ', '')}/?hl=en/`
      selector = 'img.FFVAD';
      selectorsToImageUrlConverter = items => items.map(item => item.src);
      break;
    case 'flickr':
      encodedUrl = text => `https://www.flickr.com/search/?text=${encodeURIComponent('"' + text + '"')}`
      selector = '.photo-list-photo-view';
      selectorsToImageUrlConverter = items => items.map(item => 'https:' + item.style["backgroundImage"].match(/^url\("(.*)"\)$/)[1]);
      moreResultsButtonSelector = 'button.alt';
      break;
    default:
      throw `Unknown engine: ${engine}`;
  }

  await page.goto(encodedUrl(translated_term), {waitUntil: 'load'});

  await page.waitFor(2000);

  let timesNumResultsNotChanged = 0;
  let lastNumResults = 0;
  let numResults = 0;
  const scrollingBar = new ProgressBar('Scrolling for results ... [:bar] :current/:total :percent', {
    total: target,
    incomplete: ' ',
    width: 100,
  });
  while ((numResults < target) && timesNumResultsNotChanged < 100) {
    lastNumResults = numResults;
    await page.evaluate(moreResultsButtonSelector => {
      const btn = document.querySelector(moreResultsButtonSelector);
      if (btn) {
        btn.click();
      }
      window.scrollBy(0, 100);
    }, moreResultsButtonSelector);
    await page.waitFor(100);
    numResults = await page.$$eval(selector, items => items.length);
    scrollingBar.tick(numResults - lastNumResults);
    if (numResults === lastNumResults) {
      timesNumResultsNotChanged++;
    } else {
      timesNumResultsNotChanged = 0;
    }
  }

  if (!scrollingBar.complete) {
    console.log(`Engine stopped providing additional images after ${numResults} results.`);
  }

  const urls = await page.$$eval(selector, selectorsToImageUrlConverter);

  const imageDir = `./${term.replace(' ', '_')}-${lang}-${engine}-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}/`;
  await fs.promises.mkdir(imageDir);

  let successful_urls = [];
  let md5s = new Set();
  let failed_urls = [];
  let dup_urls = [];
  let conseq_dups = 0;
  let count = 0;
  const numActualResults = Math.min(target, numResults);
  const downloadBar = new ProgressBar('Downloading images ... [:bar] :current/:total :percent', {
    total: numActualResults,
    incomplete: ' ',
    width: 100,
  });
  for (const url of urls.slice(0, numActualResults)) {
    if (conseq_dups > 30) break;
    const dest = imageDir + `${count.toString().padStart(5, '0')}`;
    if (/^data:/.test(url)) {
      downloadBar.interrupt('Trying to convert data image URL ...');
      try {
        const matches = url.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        const typeParts = matches[1].split('/');
        const buffer = Buffer.from(matches[2], 'base64');
        const name = dest.concat('.', typeParts[1]);
        const hash = crypto.createHash('md5').update(buffer).digest('hex')
        if (md5s.has(hash)) {
          downloadBar.interrupt(`Duplicate image file: ${hash}`);
          dup_urls.push({name: name, url: 'data', md5: hash}); 
          conseq_dups += 1;
	} else {
          await fs.promises.writeFile(name, buffer);
          successful_urls.push({name: name, url: 'data', md5: hash});
          md5s.add(hash);
          count++;
          conseq_dups = 0;
	}
      } catch (err) {
        failed_urls.push(url);
        console.error(err);
      }
    } else if (/^http/.test(url)) {
      downloadBar.interrupt('Trying to convert data image URL ...');
      try {
        const namePlaceholder = dest.concat('.', 'xxx');
        const {filename, image} = await download.image({url: url, dest: namePlaceholder, timeout: 5000});
        const hash = crypto.createHash('md5').update(image).digest('hex')
        if (md5s.has(hash)) {
          downloadBar.interrupt(`Duplicate image file: ${hash}`);
          dup_urls.push({name: filename, url: url, md5: hash}); 
          conseq_dups += 1;
          await fs.promises.unlink(namePlaceholder);
	} else {
          const {ext, mime} = imageType(image);
          const name = dest.concat('.', ext);
          await fs.promises.rename(namePlaceholder, name);
          successful_urls.push({name: name, url: url, md5: hash});
          md5s.add(hash);
          count++;
          conseq_dups = 0;
	}
      } catch (err) {
        failed_urls.push(url);
        console.error(err);
      }
    } else {
      downloadBar.interrupt(`Unknown URL return: ${url}`);
    }
    await page.waitFor(1000);
    downloadBar.tick(1);
  }

  if (!downloadBar.complete) {
    console.log(`Stopped downloading images after 30 consecutive duplicates.`);
  }

  await fs.promises.writeFile(imageDir + 'successful_urls.json', JSON.stringify(successful_urls) + '\n');
  await fs.promises.writeFile(imageDir + 'failed_urls.json', JSON.stringify(failed_urls) + '\n');
  await fs.promises.writeFile(imageDir + 'dup_urls.json', JSON.stringify(dup_urls) + '\n');

  await browser.close();
};

module.exports.scrapeImages = scrapeImages;
