import * as ES from 'elasticsearch';
import { createPermitsIndexer } from './permits';
import { createLotsIndexer } from './lots';
import { createBlocksIndexer } from './blocks';
import { createIncidentsIndexer } from './incidents';
import { createProspectingIndexer } from './prospecting';
import { createFoldersIndexer } from './folders';
import { createFolderItemsIndexer } from './folderItem';
import { createOrganizationListingIndexer } from './organizationListing';
import { createOrganizationIndexer } from './organizations';
import { createWallPostsIndexer } from './wallPosts';

export let ElasticClient = new ES.Client({
    host: process.env.ELASTIC_ENDPOINT
});

export const LotIndexer = createLotsIndexer(ElasticClient);
export const BlocksIndexer = createBlocksIndexer(ElasticClient);
export const PermitsIndexer = createPermitsIndexer(ElasticClient);
export const IncidentsIndexer = createIncidentsIndexer(ElasticClient);
export const ProspectingIndexer = createProspectingIndexer(ElasticClient);
export const FolderIndexer = createFoldersIndexer(ElasticClient);
export const FolderItemIndexer = createFolderItemsIndexer(ElasticClient);
export const OrganizationListingIndexer = createOrganizationListingIndexer(ElasticClient);
export const OrganizationIndexer = createOrganizationIndexer(ElasticClient);
export const WalPostsIndexer = createWallPostsIndexer(ElasticClient);

export async function enableIndexer() {
    if (!process.env.ELASTIC_ENDPOINT) {
        throw new Error('Elastic Search not configured!');
    }
    PermitsIndexer.start();
    LotIndexer.start();
    BlocksIndexer.start();
    IncidentsIndexer.start();
    ProspectingIndexer.start();
    FolderIndexer.start();
    FolderItemIndexer.start();
    OrganizationListingIndexer.start();
    OrganizationIndexer.start();
    WalPostsIndexer.start();
}