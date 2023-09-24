#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { download } = require('../lib');

const argv = yargs(hideBin(process.argv))
  .usage('Usage: $0 url')
  .command('download-cloud-dicom', 'Download cloud dicom files')
  .example('$0 https://ylyyx.shdc.org.cn/#/home?sid=123456&token=00d30818a7880c123456e1be10fc88bc&appid=SHPulmH')
  // command
  .demandCommand(1, 'url is required.')
  // help
  .help('h')
  .alias('h', 'help')
  // copyright
  .epilog('copyright 2023')
  .argv;

const [url] = argv._;

download(url)
  .catch((e) => { console.error(e); });
