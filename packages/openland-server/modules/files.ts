import Storage from '@google-cloud/storage';
import UUID from 'uuid/v4';

const filesStorage = Storage();
const filesBucket = process.env.FILES_BUCKET as string;

export async function checkFilesConfig() {
    if (!filesBucket) {
        throw new Error('Buckets are not configured');
    }
    try {
        let bucket = filesStorage.bucket(filesBucket);
        await bucket.getFiles();
    } catch (e) {
        console.warn(e);
        throw new Error('Unable to connect to the bucket');
    }
}

// export class StorageContainer {
//     private name: string;
//     private bucket: Storage.Bucket;

//     constructor(name: string) {
//         this.name = name;
//         this.bucket = files.bucket(name);
//     }
// }

export enum ContentType {
    BINARY = 'application/octet-stream',
    CSV = 'text/csv'
}

export class FileProvider {
    private name: string;

    constructor(name: string) {
        this.name = name;
    }

    async createFile(name: string, contents: string, contentType: ContentType): Promise<string> {
        let uuid = UUID();
        let link = 'https://' + filesBucket + '/' + this.name + '/' + uuid + '/' + name;
        let file = filesStorage.bucket(filesBucket).file(this.name + '/' + uuid + '/' + name);
        await file.save(contents, {
            metadata: {
                contentType: contentType,
            },
            public: true,
            validation: 'md5'
        });
        return link;
    }
}