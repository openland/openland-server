import request from 'request';

export interface UploadCareFileInfo {
    isStored: boolean;
    imageWidth: number | null;
    imageHeight: number | null;
    imageFormat: string | null;
    mimeType: string;
    name: string;
    size: number;
}

export class UploadCare {
    async fetchFileInfo(uuid: string): Promise<UploadCareFileInfo> {
        let res = await new Promise<any>(
            (resolver, reject) => request(
                {
                    url: 'https://api.uploadcare.com/files/' + uuid + '/',
                    headers: {
                        'Authorization': 'Uploadcare.Simple b70227616b5eac21ba88:65d4918fb06d4fe0bec8'
                    }
                },
                (error, response, body) => {
                    if (!error && response.statusCode === 200) {
                        resolver(JSON.parse(body));
                    } else {
                        reject(error);
                    }
                }));
        let isImage = res.is_image as boolean;
        let imageWidth = isImage ? res.image_info.width as number : null;
        let imageHeight = isImage ? res.image_info.height as number : null;
        let imageFormat = isImage ? res.image_info.format as string : null;
        let mimeType = res.mime_type as string;
        let name = res.original_filename as string;
        let size = res.size as number;
        let isReady = res.is_ready as boolean;

        return {
            isStored: isReady,
            imageWidth,
            imageHeight,
            imageFormat,
            mimeType,
            name,
            size
        };
    }
}