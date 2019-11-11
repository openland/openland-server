import { tmpdir } from 'os';
import { writeFile, unlink, readFile } from 'fs';
import { join } from 'path';
import { randomString } from './random';
import { promisify } from 'util';
import { exec } from 'child_process';

const TEMP_DIR = tmpdir();
const fsWrite = promisify(writeFile);
const fsUnlink = promisify(unlink);
const fsRead = promisify(readFile);
const asyncExec = promisify(exec);

export async function ico2png(icon: Buffer): Promise<Buffer> {
    let fileName = randomString(10) + '.ico';
    await fsWrite(join(TEMP_DIR, fileName), icon);

    let iconSizes = iconsInfo(icon).sort((a, b) => b.h * b.w - a.h * a.w);
    let biggestIconIndex = iconSizes[0].index;

    let outFileName = randomString(10) + '.png';
    await asyncExec(`convert ${join(TEMP_DIR, fileName)}[${biggestIconIndex}] ${join(TEMP_DIR, outFileName)}`);

    let converted = await fsRead(join(TEMP_DIR, outFileName));
    await fsUnlink(join(TEMP_DIR, fileName));
    await fsUnlink(join(TEMP_DIR, outFileName));

    return converted;
}

function iconsInfo(icon: Buffer): {w: number, h: number, index: number}[] {
    let iconSizes: {w: number, h: number, index: number}[] = [];
    let iconsCount = icon.readInt16LE(4);

    for (let i = 0; i < iconsCount; i++) {
        let offset = 6 + i * 16;
        let w = icon.readInt8(offset);
        if (w === 0) {
            w = 256;
        }
        let h = icon.readInt8(++offset);
        if (h === 0) {
            h = 256;
        }
        iconSizes.push({ w, h, index: i });
    }
    return iconSizes;
}