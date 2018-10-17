import { checkFilesConfig } from '../modules/files';

export async function initFiles() {
    await checkFilesConfig();
}