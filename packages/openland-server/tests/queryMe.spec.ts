import gql from 'graphql-tag';
import prepareApp from './utils/prepareApp';
import { createApiClient } from './utils/createClient';

beforeAll(prepareApp);

const emptyClient = createApiClient();
const defaultClient = createApiClient({ uid: 2 });

describe('Me Query', () => {
    it('Should return null for non-authenticated user', async () => {
        let res = await emptyClient.query({
            query: gql`
              query {
                  me {
                      id
                  }
              }
            `
        });
        expect(res.data).toMatchSnapshot();
    });
    it('Should return profile for user with profile', async () => {
        let res = await defaultClient.query({
            query: gql`
              query {
                  me {
                      id
                      name
                      firstName
                      lastName
                  }
              }
            `
        });
        expect(res.data).toMatchSnapshot();
    });

    it('Should be able to update profile', async () => {
        let res = await defaultClient.mutate({
            mutation: gql`
                mutation {
                    updateProfile(input:{firstName:"Gelb", lastName:"Putintsev"}) {
                        id
                        firstName
                        lastName
                    }
                }
            `
        });
        expect(res.data).toMatchSnapshot();
        let res2 = await defaultClient.query({
            query: gql`
              query {
                  me {
                      id
                      name
                      firstName
                      lastName
                  }
              }
            `
        });
        expect(res2.data).toMatchSnapshot();
        let res3 = await defaultClient.mutate({
            mutation: gql`
                mutation {
                    updateProfile(input:{firstName:"Steve", lastName:"Kite"}) {
                        id
                        firstName
                        lastName
                    }
                }
            `
        });
        expect(res3.data).toMatchSnapshot();
    });

    it('Should preserve old profile info on second createProfile call', async () => {
        let res = await defaultClient.mutate({
            mutation: gql`
                mutation {
                    createProfile(input:{firstName:"Gelb", lastName:"Putintsev"}) {
                        id
                        firstName
                        lastName
                    }
                }
            `
        });
        expect(res.data).toMatchSnapshot();
        let res2 = await defaultClient.query({
            query: gql`
              query {
                  me {
                      id
                      name
                      firstName
                      lastName
                  }
              }
            `
        });
        expect(res2.data).toMatchSnapshot();
    });
});