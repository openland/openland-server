import { initDatabase } from '../../init/initDatabase';
import { initFiles } from '../../init/initFiles';
import { initElastic } from '../../init/initElastic';
import { initWorkers } from '../../workers';

var inited = false;

export default async function prepareApp() {
    if (inited) {
        throw Error('Already inited!');
    }
    inited = true;
    await initDatabase(true, false);
    await initFiles();
    await initElastic();
    await initWorkers();
}