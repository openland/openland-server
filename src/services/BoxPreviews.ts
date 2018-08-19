import { CacheRepository } from '../repositories/CacheRepository';
import { Services } from '.';
import { UploadCareFileInfo } from './UploadCare';
import request from 'request';
import tmp from 'tmp';
import fs from 'fs';

export interface BoxPreviewsResult {
    fileExists: boolean;
    boxAllowed: boolean;
    boxId?: string;
}

export class BoxPreviews {
    private cache = new CacheRepository<BoxPreviewsResult>('box_preview_generator');

    async generatePreviewId(boxId: string): Promise<string> {
        console.log(boxId);
        let res = await new Promise<any>((resolve, reject) => {
            request.get({
                uri: 'https://api.box.com/2.0/files/' + boxId + '?fields=expiring_embed_link',
                headers: {
                    'Authorization': 'Bearer heP5mOCsPEVBNalPI49Y1Vt9QkggoKKZ'
                }
            }, (error, response, body) => {
                console.log(error);
                console.log(response);
                console.log(body);
                if (!error && (response.statusCode === 200 || response.statusCode === 409)) {
                    resolve(JSON.parse(body));
                } else {
                    reject(error);
                }
            });
        });

        return res.expiring_embed_link.url as string;
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
            request.post({
                uri: 'https://upload.box.com/api/2.0/files/content',
                headers: {
                    'Authorization': 'Bearer heP5mOCsPEVBNalPI49Y1Vt9QkggoKKZ'
                },
                formData: {
                    file: fs.createReadStream(tmpFile.path),
                    attributes: JSON.stringify({
                        name: 'ucare_' + uuid + '_' + info.name,
                        parent: {
                            id: '0'
                        }
                    })
                }
            }, (error, response, body) => {
                if (!error && (response.statusCode === 200 || response.statusCode === 409)) {
                    resolve(JSON.parse(body));
                } else {
                    reject(error);
                }
            });
        });

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

        let ures = {
            fileExists: true,
            boxAllowed: true,
            boxId
        };
        await this.cache.write(uuid, ures);
        return ures;
    }
}