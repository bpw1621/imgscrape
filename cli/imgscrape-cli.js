#!/usr/bin/env node

'use strict'

require('dotenv').config();

const argv = require('yargs')
  .usage('$0 <command> [options]')

  .command({
    command: 'scrape',
    describe: 'The main image scraping command.',
    builder: yargs => yargs
      .option('term', {
        demand: true,
        type: 'string',
        desc: 'the text to search for',
        alias: 't'
      })
      .option('lang', {
        demand: false,
        type: 'string',
        desc: 'language to translate text to for searching',
        alias: 'l'
      })
      .option('engine', {
        demand: false,
        type: 'string',
        desc: 'image search engine to use',
        alias: 'e'
      })
      .option('target', {
        demand: false,
        type: 'number',
        desc: 'Target number of images to return.',
        alias: 'n'
      })
      .example('imgscrape scrape --term batman --engine google --target 10')
      .example('imgscrape scrape -t spiderman -l fr -e bing -n 200')
      ,
    handler: yargs => {
      require('../lib/scrapeImages').scrapeImages(yargs);
    }
  })

  .recommendCommands()
  .showHelpOnFail(true)

  .help('h')
  .alias('help', 'h')
  .alias('version', 'v')

  .epilogue('imgscrape: scrape images from popular internet search engines!')

  .argv;

