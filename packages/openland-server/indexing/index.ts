import * as ES from 'elasticsearch';
import { createOrganizationIndexer } from './organizations';
import { createChannelIndexer } from './channels';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

export let ElasticClient = new ES.Client({
    host: process.env.ELASTIC_ENDPOINT
});
export const OrganizationIndexer = createOrganizationIndexer(ElasticClient);
export const ChannelsIndexer = createChannelIndexer(ElasticClient);

export async function enableIndexer() {
    if (serverRoleEnabled('workers')) {
        OrganizationIndexer.start();
        ChannelsIndexer.start();
    }
}