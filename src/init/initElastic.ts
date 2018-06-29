import { enableIndexer } from '../indexing';
export async function initElastic() {
    if (process.env.ELASTIC_ENABLE_INDEXING !== 'false') {
        await enableIndexer();
    }
}