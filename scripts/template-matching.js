#!/usr/bin/env node

const fs = require('fs-extra');
const jimp = require('jimp');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const SAMPLE_DATA_ROOT = path.join(PROJECT_ROOT, 'sample-data');
const SAMPLE_DATA_FORMATION_IMAGES_ROOT = path.join(SAMPLE_DATA_ROOT, 'formation-images');
const SAMPLE_DATA_TEMPLATE_IMAGES_ROOT = path.join(SAMPLE_DATA_ROOT, 'template-images');
const TMP_ROOT = path.join(PROJECT_ROOT, 'tmp');
const TMP_BUILT_IMAGES_ROOT = path.join(TMP_ROOT, 'built-images');
const TMP_BUILT_IMAGES_TEMPLATES_ROOT = path.join(TMP_BUILT_IMAGES_ROOT, 'templates');

function convertPngToGrayscale(fromFilePath, toFilePath) {
  return Promise.resolve()
    .then(() => {
      return jimp.read(fromFilePath);
    })
    .then(image => {
      return image
        .resize(Math.ceil(image.bitmap.width / 2), jimp.AUTO)
        .greyscale()
        .write(toFilePath);
    })
  ;
}

function jimpImageToMatrix(jimpImage) {
  const matrix = [];
  let currentY = -1;
  let currentX = -1;
  jimpImage.scan(0, 0, jimpImage.bitmap.width, jimpImage.bitmap.height, function(x, y, index) {
    if (y === currentY + 1) {
      matrix.push([]);
      currentY = y;
      currentX = -1;
    } else if (y > currentY + 1) {
      throw new Error('y がインクリメントされてない疑いがある');
    }
    if (x === currentX + 1) {
      matrix[y].push(jimpImage.bitmap.data[index]);
      currentX = x;
    } else if (x > currentX + 1) {
      throw new Error('x がインクリメントされてない疑いがある');
    }
  });
  return matrix;
}

/**
 * SAD (Sum of Absolute Differences)
 * https://en.wikipedia.org/wiki/Sum_of_absolute_differences
 * @param subjectMatrix darkness[][]
 * @param templateMatrix darkness[][]
 */
function searchBySad(subjectMatrix, templateMatrix, requestCount) {
  const subjectHeight = subjectMatrix.length - 1;
  const subjectWidth = subjectMatrix[0].length - 1;
  const templateHeight = templateMatrix.length - 1;
  const templateWidth = templateMatrix[0].length - 1;
  const maxSubjectY = subjectHeight - templateHeight;
  const maxSubjectX = subjectWidth - templateWidth;
  const maxTemplateY = templateHeight - 1;
  const maxTemplateX = templateWidth - 1;

  // score 昇順に並べられている前提
  const results = [];

  for (let sy = 0; sy <= maxSubjectY; sy++) {
    for (let sx = 0; sx <= maxSubjectX; sx++) {
      let score = 0;
      for (let ty = 0; ty <= maxTemplateY; ty++) {
        for (let tx = 0; tx <= maxTemplateX; tx++) {
          delta = Math.abs(subjectMatrix[sy + ty][sx + tx] - templateMatrix[ty][tx]);
          // SAD
          score += delta;
          // SSD
          //score += delta * delta;
        }
      }
      if (results.length < requestCount) {
        results.push({
          y: sy,
          x: sx,
          score,
        });
        results.sort((a, b) => a.score - b.score);
      } else if (score < results[results.length - 1].score) {
        results.pop();
        results.push({
          y: sy,
          x: sx,
          score,
        });
        results.sort((a, b) => a.score - b.score);
      }
    }
  }

  return results;
}

const images = [
  [
    path.join(SAMPLE_DATA_FORMATION_IMAGES_ROOT, 'formation-1--cropped.png'),
    path.join(TMP_BUILT_IMAGES_ROOT, 'formation-1--cropped.png'),
  ],
  [
    path.join(SAMPLE_DATA_TEMPLATE_IMAGES_ROOT, 'cost.png'),
    path.join(TMP_BUILT_IMAGES_TEMPLATES_ROOT, 'cost.png'),
  ],
  [
    path.join(SAMPLE_DATA_TEMPLATE_IMAGES_ROOT, 'dina.png'),
    path.join(TMP_BUILT_IMAGES_TEMPLATES_ROOT, 'dina.png'),
  ],
  [
    path.join(SAMPLE_DATA_TEMPLATE_IMAGES_ROOT, 'leda.png'),
    path.join(TMP_BUILT_IMAGES_TEMPLATES_ROOT, 'leda.png'),
  ],
  [
    path.join(SAMPLE_DATA_TEMPLATE_IMAGES_ROOT, 'mikoto.png'),
    path.join(TMP_BUILT_IMAGES_TEMPLATES_ROOT, 'mikoto.png'),
  ],
  [
    path.join(SAMPLE_DATA_TEMPLATE_IMAGES_ROOT, 'remy.png'),
    path.join(TMP_BUILT_IMAGES_TEMPLATES_ROOT, 'remy.png'),
  ],
  [
    path.join(SAMPLE_DATA_TEMPLATE_IMAGES_ROOT, 'tenma.png'),
    path.join(TMP_BUILT_IMAGES_TEMPLATES_ROOT, 'tenma.png'),
  ],
];


//
// main
//

fs.removeSync(TMP_ROOT);
fs.ensureDirSync(TMP_BUILT_IMAGES_TEMPLATES_ROOT);

let subjectImageMatrix;
let templateImageMatrix;

Promise.resolve()
  .then(() => {
    return Promise.all(images.map(([from, to]) => convertPngToGrayscale(from, to)));
  })
  .then(() => {
    return jimp.read(images[0][1])
      .then(image => {
        console.log('Image =', image.bitmap.width, image.bitmap.height, image.bitmap.data.length);
        subjectImageMatrix = jimpImageToMatrix(image);
      })
    ;
  })
  .then(() => {
    return jimp.read(images[1][1])
      .then(image => {
        // RGBA で 1 ピクセル(画素)辺り 4 バイト割り当てられている
        // 実際はグレースケールしたので、[x, x, x, 255] になっていて x は同じ値
        console.log('Image =', image.bitmap.width, image.bitmap.height, image.bitmap.data.length);
        templateImageMatrix = jimpImageToMatrix(image);
      })
    ;
  })
  .then(() => {
    const searchResults = searchBySad(subjectImageMatrix, templateImageMatrix, 20);
    console.log(searchResults);
  })
;
