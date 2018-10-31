import * as fs from 'fs';
import * as path from 'path';

function findAllFilesImpl(dir: string, condition: (src: string) => boolean) {
    let ex = fs.readdirSync(dir);
    let res: string[] = [];
    for (let e of ex) {
        let fullPath = dir + e;
        if (fs.lstatSync(fullPath).isDirectory()) {
            let r2 = findAllFilesImpl(fullPath + '/', condition);
            for (let e2 of r2) {
                res.push(e2);
            }
        } else {
            if (condition(fullPath)) {
                res.push(fullPath);
            }
        }
    }
    return res;
}

export function findAllFiles(dir: string, condition: (src: string) => boolean) {
    let rdir = path.resolve(dir) + '/';
    return findAllFilesImpl(rdir, condition);
}