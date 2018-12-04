import { prepareServer } from './utils/prepareServer';
import { ApiModule } from 'openland-module-api/ApiModule';
import gql from 'graphql-tag';

describe('Authentication', () => {
    let api: ApiModule;
    beforeAll(async () => {
        api = await prepareServer();
    });
    it('should work', async () => {
        let client = await api.createClientForUser('test1111@openland.com');
        let res = (await client.query({
            query: gql`
            query Status {
                me {
                    id
                }
            }
        ` })).data as any;
        expect(res.me).toBeNull();
    });
});