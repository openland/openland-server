import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { Store } from './FDB';

describe('Store', () => {

    beforeAll(async () => {
        await testEnvironmentStart('messaging-mediator');
    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should load environment variable', async () => {
        let data = JSON.parse('{\"name\":\"api-error-reporting-bot-id\",\"value\":\"2121\",\"createdAt\":1552053786059,\"updatedAt\":1552053786059,\"_version\":1}');
        (Store.EnvironmentVariable as any)._codec.decode(data);
    });
});