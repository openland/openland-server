import * as Storage from '@google-cloud/storage';

const filesStorage = Storage();
const filesBucket = process.env.FILES_BUCKET as string;

// export class StorageContainer {
//     private name: string;
//     private bucket: Storage.Bucket;

//     constructor(name: string) {
//         this.name = name;
//         this.bucket = files.bucket(name);
//     }
// }

export async function checkFilesConfig() {
    if (!filesBucket) {
        throw Error('Buckets are not configured');
    }
    try {
        let bucket = filesStorage.bucket(filesBucket);
        await bucket.getFiles();
    } catch (e) {
        console.warn(e);
        throw Error('Unable to connect to the bucket');
    }
}