import request from 'request';

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
                    reject(new Error('File error'));
                    // reject(error);
                }
            });
        });
    }

    async fetchFileInfo(uuid: string): Promise<UploadCareFileInfo> {
        let res = await this.call('files/' + uuid + '/');

        let isImage = !!(res.is_image);
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
        let res = await new Promise<any>((resolve, reject) => {
            request({
                encoding: null,
                url: `https://ucarecdn.com/${uuid}/-/preview/20x20/-/format/jpeg/-/quality/lightest/`
            }, (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    resolve(body);
                } else {
                    reject(new Error('File error'));
                }
            });
        });

        return `data:image/jpeg;base64,${res.toString('base64')}`;
    }
}