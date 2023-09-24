const Sites = [
];

const download = async (url) => {
  console.log(`> Process: ${url}`);
  for (let i = 0; i < Sites.length; i++) {
    const site = Sites[i];
    if (site.test(url)) {
      await site.download(url);
      break;
    }
  }
};

module.exports = { download };
