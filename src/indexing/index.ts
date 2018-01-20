import * as ES from 'elasticsearch';
import { startPermitsIndexer } from './permits';
import { startLotsIndexer } from './lots';

export let ElasticClient = new ES.Client({
    host: process.env.ELASTIC_ENDPOINT
});

export async function enableIndexer() {
    console.warn('Starting Elastic Search Indexing (' + process.env.ELASTIC_ENDPOINT + ')');
    startPermitsIndexer(ElasticClient);
    startLotsIndexer(ElasticClient);
}