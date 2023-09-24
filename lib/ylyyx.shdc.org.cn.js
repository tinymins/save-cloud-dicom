const fs = require('fs');
const Axios = require('axios').default;
const querystringify = require('querystringify');
const md5 = require('md5');

const URL_PREFIX = "https://ylyyx.shdc.org.cn/#/home?";

const test = (url) => {
  return url.startsWith(URL_PREFIX)
}

const generateNonceStr = (len) => {
  for (var str = "", n = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", i = n.length, r = 0; r < len; r++)
      str += n.charAt(Math.floor(Math.random() * i));
  return str;
};

const signApiUrl = (str) => {
  const sign = md5(`${str.split('?')[1]}&key=5fbcVzmBJNUsw53#`)
  return `${str}&sign=${sign}`;
}

const generateAuthorizationSignature = (params) => {
  var value = "";
  var obj = Object.assign({}, params);
  for (var k in obj) {
    value = value.concat("".concat(obj[k], ";"));
  }
  var s = md5("".concat(value).concat("5fbcVzmBJNUsw53#"));
  return "".concat(s)
};

const generateAuthorization = (sid, token, sliceName) => {
  var currentTime = (new Date).getTime();
  var params = {
    sid: sid,
    token: token,
    time: currentTime,
    path: sliceName
  };
  return `Basic ${sid};${token};${currentTime};${generateAuthorizationSignature(params)}`;
}

const download = async(url) => {
  const qs = querystringify.parse(url.substr(URL_PREFIX.length));
  const nonceStr = generateNonceStr;
  // 获取信息
  const resInfo = await Axios({
    url: signApiUrl(`https://ylyyx.shdc.org.cn/api001/study/detail?sid=${qs.sid}&mode=0&nonce_str=${nonceStr}&token=${qs.token}`)
  }).catch((error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error(`× Get study info failed. [${status}] ${JSON.stringify(data)}`);
    throw error;
  });
  if (resInfo.data.code === 1005) {
    console.error(`× Get study info failed. [该链接已经过期，请该检查的患者重新分享。] `);
    throw new Error('Get study info failed.');
  } else if (!resInfo.data.study) {
    console.error(`× Get study info failed. [data] ${JSON.stringify(data)}`);
    throw new Error('Get study info error.');
  };
  // 获取列表
  const res = await Axios({
    url: signApiUrl(`https://ylyyx.shdc.org.cn/api001/series/list?sid=${qs.sid}&nonce_str=${nonceStr}&token=${qs.token}`),
    method: 'GET',
    // headers: { cookie },
    maxRedirects: 0,
  }).catch((error) => {
    const status = error?.response?.status;
    const data = error?.response?.data;
    console.error(`× Get series list failed. [${status}] ${JSON.stringify(data)}`);
    throw error;
  });
  if (res.data.code === 1005) {
    console.error(`× Get series list failed. [该链接已经过期，请该检查的患者重新分享。] `);
    throw new Error('Get series list failed.');
  } else if (!res.data.result) {
    console.error(`× Get series list failed. [data] ${JSON.stringify(data)}`);
    throw new Error('Get series list error.');
  }
  // 遍历 series 列表
  let retryCount = 0;
  for (let i = 0; i < res.data.result.length; i++) {
    const series = res.data.result[i];
    // 创建本地目录
    const dir = `downloads/${resInfo.data.study.study_date.replaceAll('-', '')}${resInfo.data.study.study_time.replaceAll(':', '')}.${resInfo.data.study.hospital}.${resInfo.data.study.patient_id}.${resInfo.data.study.patient_name}.${resInfo.data.study.modality_type}.${resInfo.data.study.description}.${resInfo.data.study.study_id}/${series.series_date.replaceAll('-', '')}${series.series_time.replaceAll(':', '')}.${series.description}.${series.series_id}`;
    if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
    }
    // 遍历处理子文件
    const sliceNames = series.names.split(',');
    for (let j = 0; j < sliceNames.length; j++) {
      const sliceName = sliceNames[j];
      const sliceUrl = `https://ylyyx.shdc.org.cn/${res.data.folder_pre}/${series.source_folder}/${sliceName}`;
      const sliceFile = `${dir}/${sliceName}`;
      // 下载文件
      console.log(`> Download DICOM: ${sliceUrl}`);
      try {
        const writer = fs.createWriteStream(sliceFile);
        const response = await Axios({
          url: sliceUrl,
          method: 'GET',
          headers: {
            Authorization: generateAuthorization(qs.sid, qs.token, sliceName),
          },
          responseType: 'stream',
          maxRedirects: 0,
        });
        response.data.pipe(writer);

        console.log(`> Save file: ./${sliceFile}`);
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
        retryCount = 0;
      } catch {
        if (retryCount < 10) {
          j = j - 1;
          retryCount = retryCount + 1;
        } else {
          retryCount = 0;
          console.error(`> Process failed: ${sliceUrl}`);
        }
      }
    }
  }
  console.log('Download Success.');
}

module.exports = { test, download };
