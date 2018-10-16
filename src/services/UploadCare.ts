import request from 'request';
import * as Path from 'path';
import { tmpdir } from 'os';
import { randomString } from '../utils/random';
import FormData from 'form-data';
import { createReadStream, unlink, writeFile } from 'fs';
import fetch from 'node-fetch';
import { promisify } from 'util';
import { extname } from 'path';

const writeFileAsync = promisify(writeFile);
const unlinkFile = promisify(unlink);

export interface UploadCareFileInfo {
    isImage: boolean;
    isStored: boolean;
    imageWidth: number | null;
    imageHeight: number | null;
    imageFormat: string | null;
    mimeType: string;
    name: string;
    size: number;
}

export class UploadCare {
    static UPLOAD_CARE_PUB_KEY = 'b70227616b5eac21ba88';
    static UPLOAD_CARE_AUTH = 'Uploadcare.Simple b70227616b5eac21ba88:65d4918fb06d4fe0bec8';

    async call(path: string, method: string = 'GET'): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            request({
                method,
                url: 'https://api.uploadcare.com/' + path,
                headers: {
                    'Authorization': UploadCare.UPLOAD_CARE_AUTH
                }
            }, (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    resolve(JSON.parse(body));
                } else {
                    console.warn(error);
                    reject(new Error('File error'));
                    // reject(error);
                }
            });
        });
    }

    async fetchFileInfo(uuid: string): Promise<UploadCareFileInfo> {
        let res = await this.call('files/' + uuid + '/');

        let isImage = (!!(res.is_image) || res.image_info);
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

    async saveFile(uuid: string): Promise<UploadCareFileInfo> {
        let fileInfo = await this.fetchFileInfo(uuid);

        if (!fileInfo.isStored) {
            await this.call('/files/' + uuid + '/storage', 'PUT');
            fileInfo.isStored = true;
        }

        return fileInfo;
    }

    async fetchLowResPreview(uuid: string): Promise<string> {
        console.log(`https://ucarecdn.com/${uuid}/-/preview/20x20/-/format/jpeg/-/quality/lightest/`);
        let res = await new Promise<any>((resolve, reject) => {
            request({
                encoding: null,
                url: `https://ucarecdn.com/${uuid}/-/preview/20x20/-/format/jpeg/-/quality/lightest/`,
                headers: {
                    // 'Authorization': UploadCare.UPLOAD_CARE_AUTH
                }
            }, (error, response, body) => {
                console.log(error, response.statusCode);
                if (!error && response.statusCode === 200) {
                    resolve(body);
                } else {
                    console.warn(error);
                    reject(new Error('File error'));
                }
            });
        });

        return `data:image/jpeg;base64,${res.toString('base64')}`;
    }

    async upload(imgData: Buffer, ext?: string): Promise<{ file: string }> {

        let tmpPath = Path.join(tmpdir(), `${randomString(7)}${ext ? ext : '.dat'}`);
        await writeFileAsync(tmpPath, imgData);

        let form = new FormData();
        form.append('UPLOADCARE_STORE', '1');
        form.append('UPLOADCARE_PUB_KEY', UploadCare.UPLOAD_CARE_PUB_KEY);
        form.append('file', createReadStream(tmpPath));

        let res = await fetch(
            'https://upload.uploadcare.com/base/',
            { method: 'POST', body: form }
        );

        await unlinkFile(tmpPath);

        return res.json();
    }

    async uploadFromUrl(url: string) {
        let data = await (await fetch(url)).buffer();

        return this.upload(data, (extname(url).length > 0) ? extname(url) : undefined);
    }
}