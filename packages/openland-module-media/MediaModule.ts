import request from 'request';
import * as Path from 'path';
import { tmpdir } from 'os';

import FormData from 'form-data';
import { createReadStream, unlink, writeFile } from 'fs';
import fetch from 'node-fetch';
import { promisify } from 'util';
import { extname } from 'path';
import { randomString } from 'openland-utils/random';
import { FileInfo } from './FileInfo';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { createTracer } from 'openland-log/createTracer';
import { createLogger } from '@openland/log';

const writeFileAsync = promisify(writeFile);
const unlinkFile = promisify(unlink);
const tracer = createTracer('uploadcare');
const logger = createLogger('uploadcare');

@injectable()
export class MediaModule {
    static UPLOAD_CARE_PUB_KEY = 'b70227616b5eac21ba88';
    static UPLOAD_CARE_AUTH = 'Uploadcare.Simple b70227616b5eac21ba88:65d4918fb06d4fe0bec8';

    start = async () => {
        // Nothing to do
    }

    async fetchFileInfo(ctx: Context, uuid: string): Promise<FileInfo> {
        let res = await this.call(ctx, 'files/' + uuid + '/');

        let isImage = !!(res.is_image || res.image_info);
        let imageWidth = isImage ? res.image_info.width as number : null;
        let imageHeight = isImage ? res.image_info.height as number : null;
        let imageFormat = isImage ? res.image_info.format as string : null;
        let mimeType = res.mime_type as string;
        let name = res.original_filename as string;
        let size = res.size as number;
        let isReady = !!(res.is_ready);

        return {
            isStored: isReady,
            isImage,
            imageWidth,
            imageHeight,
            imageFormat,
            mimeType,
            name,
            size
        };
    }

    sanitizeFileInfo(input: any): FileInfo | null {
        if (input === null) {
            return null;
        }
        return {
            isStored: Boolean(input.isStored),
            isImage: Boolean(input.isImage),
            imageWidth: Number(input.imageWidth) || null,
            imageHeight: Number(input.imageHeight) || null,
            imageFormat: String(input.imageFormat) || null,
            mimeType: String(input.imageFormat) || 'unknown',
            name: String(input.name) || 'unknown',
            size: Number(input.size) || 0
        };
    }

    async saveFile(ctx: Context, uuid: string): Promise<FileInfo> {
        let fileInfo = await this.fetchFileInfo(ctx, uuid);

        if (!fileInfo.isStored) {
            await this.call(ctx, '/files/' + uuid + '/storage', 'PUT');
            fileInfo.isStored = true;
        }
        return fileInfo;
    }

    async fetchLowResPreview(ctx: Context, uuid: string): Promise<string> {
        logger.log(ctx, `https://ucarecdn.com/${uuid}/-/preview/20x20/-/format/jpeg/-/quality/lightest/`);
        let res = await new Promise<any>((resolve, reject) => {
            request({
                encoding: null,
                url: `https://ucarecdn.com/${uuid}/-/preview/20x20/-/format/jpeg/-/quality/lightest/`,
                headers: {
                    // 'Authorization': UploadCare.UPLOAD_CARE_AUTH
                }
            }, (error, response, body) => {
                logger.warn(ctx, error, response.statusCode);
                if (!error && response.statusCode === 200) {
                    resolve(body);
                } else {
                    logger.warn(ctx, error);
                    reject(new Error('File error'));
                }
            });
        });

        return `data:image/jpeg;base64,${res.toString('base64')}`;
    }

    async upload(ctx: Context, imgData: Buffer, ext?: string): Promise<{ file: string }> {

        let tmpPath = Path.join(tmpdir(), `${randomString(7)}${ext ? ext : '.dat'}`);
        await writeFileAsync(tmpPath, imgData);

        let form = new FormData();
        form.append('UPLOADCARE_STORE', '1');
        form.append('UPLOADCARE_PUB_KEY', MediaModule.UPLOAD_CARE_PUB_KEY);
        form.append('file', createReadStream(tmpPath));

        let res = await fetch(
            'https://upload.uploadcare.com/base/',
            { method: 'POST', body: form }
        );

        await unlinkFile(tmpPath);

        return res.json();
    }

    async uploadFromUrl(ctx: Context, url: string) {
        let data = await (await fetch(url));

        if (data.status !== 200) {
            throw new Error('Can\'t download file');
        }

        return this.upload(ctx, await data.buffer(), (extname(url).length > 0) ? extname(url) : undefined);
    }

    private async call(ctx: Context, path: string, method: string = 'GET'): Promise<any> {
        return await tracer.trace(ctx, 'call', async () => {
            return await new Promise<any>((resolve, reject) => {
                logger.log(ctx, {
                    method,
                    url: 'https://api.uploadcare.com/' + path,
                    headers: {
                        'Authorization': MediaModule.UPLOAD_CARE_AUTH
                    }
                });
                request({
                    method,
                    url: 'https://api.uploadcare.com/' + path,
                    headers: {
                        'Authorization': MediaModule.UPLOAD_CARE_AUTH
                    }
                }, (error, response, body) => {
                    if (!error && response.statusCode === 200) {
                        resolve(JSON.parse(body));
                    } else {
                        logger.warn(ctx, error, body);
                        reject(new Error('File error'));
                        // reject(error);
                    }
                });
            });
        });
    }
}
