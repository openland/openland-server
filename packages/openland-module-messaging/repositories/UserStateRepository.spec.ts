import 'reflect-metadata';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { UserStateRepository } from './UserStateRepository';

describe('UserStateRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('user-state');
        container.bind('UserStateRepository').to(UserStateRepository).inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });
    it('should correctly handle messaging state', async () => {
        let repo = container.get<UserStateRepository>('UserStateRepository');
        let state = await repo.getUserDialogState(1, 2);
        expect(state.uid).toBe(1);
        expect(state.cid).toBe(2);
        expect(state.date).toBeNull();
        expect(state.readMessageId).toBeNull();
        expect(state.unread).toBe(0);
    });
});