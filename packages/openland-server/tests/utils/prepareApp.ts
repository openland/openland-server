import { initDatabase } from '../../init/initDatabase';
import { initElastic } from '../../init/initElastic';

var inited = false;

export default async function prepareApp() {
    if (inited) {
        throw Error('Already inited!');
    }
    inited = true;
    await initDatabase(true, false);
    await initElastic();
}