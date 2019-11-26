import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { UserRepository } from './UserRepository';
import { Store } from 'openland-module-db/FDB';
import { createNamedContext } from '@openland/context';
import { AuthModule } from '../../openland-module-auth/AuthModule';
import { TokenRepository } from '../../openland-module-auth/repositories/TokenRepository';

describe('UserRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('users');
        container.bind('TokenRepository').to(TokenRepository);
        container.bind(AuthModule).to(AuthModule);
        container.bind('UserRepository').to(UserRepository).inSingletonScope();
    });
    afterAll( async () => {
      await  testEnvironmentEnd();
    });

    it('should create users', async () => {
        let repo = container.get<UserRepository>('UserRepository');
        let res = await repo.createUser(createNamedContext('test'), 'usertestauth1', 'someemail4411@open.com');
        expect(res.authId).toEqual('usertestauth1');
        expect(res.email).toEqual('someemail4411@open.com');
        expect(res.status).toEqual('pending');
    });

    it('should crash on duplicate authId', async () => {
        let repo = container.get<UserRepository>('UserRepository');
        await repo.createUser(createNamedContext('test'), 'usertestauth2', 'someemail44@open.com');
        await expect(repo.createUser(createNamedContext('test'), 'usertestauth2', 'someemail3@open.com'))
            .rejects.toThrowError();
    });

    it('should crash on duplicate email', async () => {
        let repo = container.get<UserRepository>('UserRepository');
        await repo.createUser(createNamedContext('test'), 'usertestauth244', 'someemail22@open.com');
        await expect(repo.createUser(createNamedContext('test'), 'usertestauth2445', 'someemail22@open.com'))
            .rejects.toThrowError();
    });

    it('should allow on duplicate authId for deleted accounts', async () => {
        let repo = container.get<UserRepository>('UserRepository');
        let r = await repo.createUser(createNamedContext('test'), 'usertestauth3', 'someemail@open.com');
        r = await repo.deleteUser(createNamedContext('test'), r.id);
        expect(r.status).toEqual('deleted');

        // Should be deleted from index
        let tr = await Store.User.authId.find(createNamedContext('test'), 'usertestauth3');
        expect(tr).toBeNull();

        // Should create new user
        let r2 = await repo.createUser(createNamedContext('test'), 'usertestauth3', 'someemail3@open.com');
        expect(r2).not.toBe(r.id);
    });
});