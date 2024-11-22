import {readdirSync, readFileSync, writeFileSync} from 'node:fs';

import {brotliCompressSync} from "node:zlib";

const dir = 'dist/hyperion-explorer/browser/';
readdirSync(dir).forEach(file => {
  console.log(file);
  if (file.endsWith('.js') || file.endsWith('.css') || file.endsWith('.html')) {
    const result = brotliCompressSync(readFileSync(dir + file), {});
    writeFileSync(dir + file + '.br', result);
  }
});
