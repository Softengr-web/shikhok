import { Blob, Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { convertBijoyToUnicode } from 'bijoy2unicode';
import { convertDocx } from 'bijoy2unicode/docx';

const [, , mode, sourcePath, outputPath] = process.argv;
if (mode === '--texts') {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const texts = JSON.parse(input);
  if (!Array.isArray(texts) || texts.some(value => typeof value !== 'string')) {
    throw new Error('Text conversion expects a JSON array of strings.');
  }
  process.stdout.write(JSON.stringify(texts.map(convertBijoyToUnicode)));
} else if (mode === '--docx' && sourcePath && outputPath) {
  const source = await readFile(sourcePath);
  const converted = await convertDocx(new Blob([source]));
  await writeFile(outputPath, Buffer.from(await converted.arrayBuffer()));
} else {
  throw new Error('Usage: node tools/bijoy-convert.mjs --docx <source.docx> <converted.docx> | --texts');
}
