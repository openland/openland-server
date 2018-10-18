import * as ES from 'elasticsearch';
import { createOrganizationListingIndexer } from './organizationListing';
import { createOrganizationIndexer } from './organizations';
import { createChannelIndexer } from './channels';
import { createUserProfilesIndexer } from './userProfiles';

export let ElasticClient = new ES.Client({
    host: process.env.ELASTIC_ENDPOINT
});
export const OrganizationListingIndexer = createOrganizationListingIndexer(ElasticClient);
export const OrganizationIndexer = createOrganizationIndexer(ElasticClient);
export const ChannelsIndexer = createChannelIndexer(ElasticClient);
export const UserProfiles = createUserProfilesIndexer(ElasticClient);

export async function enableIndexer() {
    if (!process.env.ELASTIC_ENDPOINT) {
        throw new Error('Elastic Search not configured!');
    }
    OrganizationListingIndexer.start();
    OrganizationIndexer.start();
    ChannelsIndexer.start();
    UserProfiles.start();
}