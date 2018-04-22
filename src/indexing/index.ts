import * as ES from 'elasticsearch';
import { createPermitsIndexer } from './permits';
import { createLotsIndexer } from './lots';
import { createBlocksIndexer } from './blocks';
import { createIncidentsIndexer } from './incidents';
import { createProspectingIndexer } from './prospecting';

export let ElasticClient = new ES.Client({
    host: process.env.ELASTIC_ENDPOINT
});

export const LotIndexer = createLotsIndexer(ElasticClient);
export const BlocksIndexer = createBlocksIndexer(ElasticClient);
export const PermitsIndexer = createPermitsIndexer(ElasticClient);
export const IncidentsIndexer = createIncidentsIndexer(ElasticClient);
export const ProspectingIndexer = createProspectingIndexer(ElasticClient);

export async function enableIndexer() {
    PermitsIndexer.start();
    LotIndexer.start();
    BlocksIndexer.start();
    IncidentsIndexer.start();
    ProspectingIndexer.start();
}