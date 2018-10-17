import { CacheRepository } from '../repositories/CacheRepository';
import { Services } from '.';
import { UploadCareFileInfo } from './UploadCare';
import request from 'request';
import tmp from 'tmp';
import fs from 'fs';

const config = {
    'boxAppSettings': {
        'clientID': 'zpc0xkgflssqwyauf41i4lc7nbu82c3v',
        'clientSecret': 'OesOoAiFIESyDS3LGlis2DcXsI5VJ3EJ',
        'appAuth': {
            'publicKeyID': '3bk984k3',
            'privateKey': '-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIFDjBABgkqhkiG9w0BBQ0wMzAbBgkqhkiG9w0BBQwwDgQIgXLt1e3Sj1kCAggA\nMBQGCCqGSIb3DQMHBAifQC85Ma63UwSCBMjsiE6j7Hlmjr9osidOWkbrdzv/zlL5\n6BY2nV8wqucC0cv7OGXX2bmFDv/TZoKTJoRtTh9f1Kx3fRsARxQhmMB0OuEgt1wa\nIFbadvmZT7vn9F78PttP/SEDLe/FGVzsxCPuDbseIVluL3ofNkMjncJ1kDiQryaE\nPuZUfqu+7/yF/TAnMLFLTgEoNgVLDmjQlV09S6TcnimfF77bDvXC15v0YRkgpwF7\nFKuH9EzEE5HS+ANscQDPLtG1Huvds2ZlF6Q+11E1MvDClUwWmkY+hKkNXOS54hxH\nLoEhfzJN9RA/au+Xf0OTkZAnEyc6Eg42ZE7f6DA+rwIyAt0H5aD8okXF+v187Ds2\nD4U6Zq/Xk6xz/rxo9F3K3nBuJBfhI3HN5VRynahmemdHr2Jn+EcB1sRbqXhcJXl3\nR8hDUIWQoIASjSa9plUAtd55wsrW1+P1HehxC6eHPe0WO0QIEMtWi+uz/OLxAvro\nsxXfC150W9FZvJrPGbGUKj6yBGscmXWJHhq/1qRXriO8iAq5d1wYAgSFDjtTygkh\nJC4R+Rvq/0dzHyWUCrmPaTKkP6ohBetrjK4og8QKrS10SesLtASTDx3hsNyh/D2d\neBi/1VUagpVs1vCVnIsY7GKnMHf+aXF2l67FbLaLbuT4GiOoY9PgY170UVjsMXzi\n0sFmW0+P8J9jMhPxkwKOdJNo30XMvjNguQsC+KTofak2JEVheYwF58sKJIAbZ0cQ\nEHfrQPXELqGkRuoy9gCc15xZbAFiv5aTpxJKsicaMc6TzXdN8OB1K66R7oK/5Qc6\njaC9mXh3+5Si12MagCLJ4kwg7OHYPuv06FQqMbWeTp1e7oF0LEa3LCj89kIFlv57\nbTnFbfJd7FNSy7c+w1FIpRVdf/ZqVKYZTkhfzMFClr09wyjuUTAimWtSHOa6fkjU\na48HiSGUqx91rRHbdXHOIwryJT7bik4xN/1WKbEqmmvWeC7RE/0SUGXzfSiGB8XN\noJrhn/Zq27zdrga56ZlE9jpY/uP2u/5kYMJucgeQ47SZvS1CGWBSPoe2GFx/4l0i\nIR2UeBb0Z2XUWwGWBBBpfDAlFAyqXY8hzXj9+MicBiuf1Js8by3Bv5UbTi5CfNtT\nHBRSnzNhkn47rEHS8TBFDjxc/XkviaVSrECoRDW5uV/7b77/c/ybgQ+UAsPCqolC\ncrPKOGk7uT8En8E3OSw2p9w6nZMO500Zovjyt+sABCVPVME610CYzlTGV964nlGQ\nPlOhsmcEHT8AW77vi0StmpSN4qfM7sLn3GNnh8xOVwu5pWOc4Vx1rLVcQO0U51lQ\n/TEO4vdOCm8svRZqL1dbHi+Y7LKddI8VFktCLo3M2iZ0lcl7jev2sYn0r6LXMQ2c\nkvbW9TH+hwoSHygfK2DGC9gH7IAOn/BqBNME5tS2mKCdtQyw8E8wNUEGYeu2DbLD\nN/veugWjOMD2Y1B8NLqPepZdQqlu3MirKexjMrTGDyZ6JiS5VsgVIHdMwLCxK8DW\nX/NwN7tJhazlNA7HqJ4fTuvBmixiTymJ9THA8p/S5sOwccZfSAN9GbbG6+YB7nym\nzvjSS16PDiWM+Byu1M+CZ+8v3zRSNWOi6b6XJBOUghO0UyU082OxlN74FiTwSBgb\nFH0=\n-----END ENCRYPTED PRIVATE KEY-----\n',
            'passphrase': 'a27d0912882e31e5df7a48686deb004d'
        }
    },
    'enterpriseID': '76531765'
};

const sdk = require('box-node-sdk').getPreconfiguredInstance(config);
const client = sdk.getAppAuthClient('enterprise', config.enterpriseID);

export interface BoxPreviewsResult {
    fileExists: boolean;
    boxAllowed: boolean;
    boxId?: string;
}

export class BoxPreviews {
    private cache = new CacheRepository<BoxPreviewsResult>('box_preview_generator');

    async generatePreviewId(boxId: string): Promise<string | null> {
        try {
            return await client.files.getEmbedLink(boxId);
        } catch (e) {
            return null;
        }
    }

    async uploadToBox(uuid: string): Promise<BoxPreviewsResult> {
        let cached = await this.cache.read(uuid);
        if (cached) {
            return cached;
        }

        // Fetch file info
        console.log('Fetching file info...');
        let info: UploadCareFileInfo;
        try {
            info = await Services.UploadCare.fetchFileInfo(uuid);
        } catch (e) {
            let res = {
                fileExists: false,
                boxAllowed: false
            };
            await this.cache.write(uuid, res);
            return res;
        }

        // Check size limit (15 mb)
        if (info.size >= 15 * 1024 * 1024) {
            let res = {
                fileExists: true,
                boxAllowed: false
            };
            await this.cache.write(uuid, res);
            return res;
        }

        // Create Temp file
        console.log('Create temp file...');
        let tmpFile = await new Promise<{ path: string, cleanupCallback: () => void }>((resolve, reject) => {
            tmp.file((err, path, fd, cleanupCallback) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        path,
                        cleanupCallback
                    });
                }
            });
        });

        // Download File
        console.log('Downloading file...');
        await new Promise((resolve, reject) => {
            request
                .get('https://ucarecdn.com/' + uuid + '/')
                .pipe(fs.createWriteStream(tmpFile.path))
                .on('error', () => {
                    reject();
                })
                .on('end', () => {
                    resolve();
                })
                .on('close', () => {
                    resolve();
                });
        });

        // Upload to Box
        console.log('Uploading file...');
        let uploadResult = await new Promise<any>((resolve, reject) => {
            client.files.uploadFile(
                '0',
                'ucare_' + uuid + '_' + info.name,
                fs.createReadStream(tmpFile.path),
                (error: any, response: any) => {
                    if (error && error.statusCode === 409) {
                        resolve(error.response.body);
                        return;
                    }
                    if (!error) {
                        resolve(response);
                    } else {
                        reject(error);
                    }
                });
        });

        // Resolve BoxID
        let boxId: string;
        if (uploadResult.type === 'error') {
            if (uploadResult.code === 'item_name_in_use') {
                boxId = uploadResult.context_info.conflicts.id as string;
            } else {
                throw Error('Unknown Error');
            }
        } else {
            boxId = uploadResult.entries[0].id as string;
        }

        // Cache result
        let ures = {
            fileExists: true,
            boxAllowed: true,
            boxId
        };
        await this.cache.write(uuid, ures);
        return ures;
    }
}