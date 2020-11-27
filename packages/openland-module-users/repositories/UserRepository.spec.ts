import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { UserRepository } from './UserRepository';
import { Store } from 'openland-module-db/FDB';
import { createNamedContext } from '@openland/context';
import { AuthModule } from '../../openland-module-auth/AuthModule';
import { TokenRepository } from '../../openland-module-auth/repositories/TokenRepository';
import { ShortnameModule } from '../../openland-module-shortname/ShortnameModule';
import { loadShortnameModule } from '../../openland-module-shortname/ShortnameModule.container';

describe('UserRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('users');
        container.bind('TokenRepository').to(TokenRepository);
        container.bind(AuthModule).to(AuthModule);
        container.bind('UserRepository').to(UserRepository).inSingletonScope();
        container.bind(ShortnameModule).toSelf().inSingletonScope();
        loadShortnameModule();
    });
    afterAll( async () => {
      await  testEnvironmentEnd();
    });

    it('should create users', async () => {
        let repo = container.get<UserRepository>('UserRepository');
        let res = await repo.createUser(createNamedContext('test'), {email: 'someemail4411@open.com'});
        expect(res.email).toEqual('someemail4411@open.com');
        expect(res.status).toEqual('activated');
    });

    // it('should crash on duplicate authId', async () => {
    //     let repo = container.get<UserRepository>('UserRepository');
    //     await repo.createUser(createNamedContext('test'), {email: 'someemail44@open.com'});
    //     await expect(repo.createUser(createNamedContext('test'), 'usertestauth2', 'someemail3@open.com'))
    //         .rejects.toThrowError();
    // });

    it('should crash on duplicate email', async () => {
        let repo = container.get<UserRepository>('UserRepository');
        await repo.createUser(createNamedContext('test'), {email: 'someemail22@open.com'});
        await expect(repo.createUser(createNamedContext('test'), {email: 'someemail22@open.com'}))
            .rejects.toThrowError();
    });

    it('should allow on duplicate email for deleted accounts', async () => {
        let repo = container.get<UserRepository>('UserRepository');
        let r = await repo.createUser(createNamedContext('test'), {email:  'someemail@open.com'});
        r = await repo.deleteUser(createNamedContext('test'), r.id);
        expect(r.status).toEqual('deleted');

        // Should be deleted from index
        let tr = await Store.User.email.find(createNamedContext('test'), 'someemail@open.com');
        expect(tr).toBeNull();

        // Should create new user
        let r2 = await repo.createUser(createNamedContext('test'), {email:  'someemail@open.com'});
        expect(r2).not.toBe(r.id);
    });
});
