import { prepareServer } from './utils/prepareServer';
import { ApiModule } from 'openland-module-api/ApiModule';
import gql from 'graphql-tag';

describe('User', () => {
    let api: ApiModule;
    beforeAll(async () => {
        api = await prepareServer();
    });
    it('should return own profile', async () => {
        let client = await api.createClientForUser('test1111@openland.com');
        let res = (await client.query({
            query: gql`
            query Me {
                me {
                    id
                    firstName
                    lastName
                    about
                    phone
                    email
                }
            }
        ` })).data as any;
        expect(res.me).toMatchSnapshot();
    });
});