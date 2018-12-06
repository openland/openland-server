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
                    isBot
                    isYou
                    firstName
                    lastName
                    about
                    phone
                    email
                    website
                    linkedin
                    twitter
                    location
                    shortname
                }
            }
        ` })).data as any;
        expect(res.me).toMatchSnapshot();
    });
    it('should return null for non-logged in user', async () => {
        let client = await api.createClient({});
        let res = (await client.query({
            query: gql`
            query Me {
                me {
                    id
                    isBot
                    isYou
                    firstName
                    lastName
                    about
                    phone
                    email
                    website
                    linkedin
                    twitter
                    location
                    shortname
                }
            }
        ` })).data as any;
        expect(res.me).toBeNull();
    });
});