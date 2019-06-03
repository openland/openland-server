import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { UserRepository } from './UserRepository';
import { FDB } from 'openland-module-db/FDB';
import { EmptyContext } from '@openland/context';

describe('UserRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('users');
        container.bind('UserRepository').to(UserRepository).inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });

    it('should create users', async () => {
        let repo = container.get<UserRepository>('UserRepository');
        let res = await repo.createUser(EmptyContext, 'usertestauth1', 'someemail4411@open.com');
        expect(res.authId).toEqual('usertestauth1');
        expect(res.email).toEqual('someemail4411@open.com');
        expect(res.status).toEqual('pending');
    });

    it('should crash on duplicate authId', async () => {
        let repo = container.get<UserRepository>('UserRepository');
        await repo.createUser(EmptyContext, 'usertestauth2', 'someemail44@open.com');
        await expect(repo.createUser(EmptyContext, 'usertestauth2', 'someemail3@open.com'))
            .rejects.toThrowError();
    });

    it('should crash on duplicate email', async () => {
        let repo = container.get<UserRepository>('UserRepository');
        await repo.createUser(EmptyContext, 'usertestauth244', 'someemail22@open.com');
        await expect(repo.createUser(EmptyContext, 'usertestauth2445', 'someemail22@open.com'))
            .rejects.toThrowError();
    });

    it('should allow on duplicate authId for deleted accounts', async () => {
        let repo = container.get<UserRepository>('UserRepository');
        let r = await repo.createUser(EmptyContext, 'usertestauth3', 'someemail@open.com');
        r = await repo.deleteUser(EmptyContext, r.id);
        expect(r.status).toEqual('deleted');

        // Should be deleted from index
        let tr = await FDB.User.findFromAuthId(EmptyContext, 'usertestauth3');
        expect(tr).toBeNull();

        // Should create new user
        let r2 = await repo.createUser(EmptyContext, 'usertestauth3', 'someemail3@open.com');
        expect(r2).not.toBe(r.id);
    });
});