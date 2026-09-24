import sharp from 'sharp';
import {readdir} from 'node:fs/promises';
import path from 'node:path';
const directory=path.resolve('public','exercises');
const files=(await readdir(directory)).filter(file=>file.endsWith('.png'));
for(const file of files){const source=path.join(directory,file),destination=path.join(directory,file.replace(/\.png$/,'.webp'));await sharp(source).resize({width:960,withoutEnlargement:true}).webp({quality:82,effort:5}).toFile(destination);}
console.log(`Optimized ${files.length} exercise illustrations.`);
