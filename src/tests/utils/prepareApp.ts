import { initDatabase } from '../../init/initDatabase';
import { initFiles } from '../../init/initFiles';
import { initElastic } from '../../init/initElastic';
import { initWorkers } from '../../workers';

export default async function prepareApp() {
    await initDatabase(true);
    await initFiles();
    await initElastic();
    await initWorkers();
}