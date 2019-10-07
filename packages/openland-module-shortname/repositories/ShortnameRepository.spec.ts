import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { ShortnameRepository } from './ShortnameRepository';
import { SuperModule } from '../../openland-module-super/SuperModule';
import { UsersModule } from '../../openland-module-users/UsersModule';
import { OrganizationModule } from '../../openland-module-organization/OrganizationModule';
import { OrganizationRepository } from '../../openland-module-organization/repositories/OrganizationRepository';
import { createNamedContext } from '@openland/context';
import { loadUsersModule } from '../../openland-module-users/UsersModule.container';

describe('ShortnameRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('shortnames');
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        loadUsersModule();
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
        container.bind('ShortnameRepository').to(ShortnameRepository).inSingletonScope();
    });
    afterAll( async () => {
      await  testEnvironmentEnd();
    });
    it('should set shortname', async () => {
        let repo = container.get<ShortnameRepository>('ShortnameRepository');
        let ctx = createNamedContext('test');
        let res = await repo.setShortName(ctx, 'hello1', 'user', 1, 1);

        expect(res).toEqual(true);

        let shortname = await repo.findShortnameByOwner(ctx, 'user', 1);

        expect(shortname).not.toBeNull();
        expect(shortname!.shortname).toEqual('hello1');
    });
    it('should not set already reserved shortname', async (done) => {
        let repo = container.get<ShortnameRepository>('ShortnameRepository');
        let ctx = createNamedContext('test');
        let res = await repo.setShortName(ctx, 'hello3', 'user', 1, 1);

        expect(res).toEqual(true);

        try {
            await repo.setShortName(ctx, 'hello3', 'user', 2, 2);
            done.fail();
        } catch (e) {
            done();
        }
    });
    it('should release shortname when changed', async () => {
        let repo = container.get<ShortnameRepository>('ShortnameRepository');
        let ctx = createNamedContext('test');
        let res = await repo.setShortName(ctx, 'hello4', 'user', 1, 1);
        res = await repo.setShortName(ctx, 'hello5', 'user', 1, 1);
        res = await repo.setShortName(ctx, 'hello4', 'user', 2, 2);
        expect(res).toEqual(true);
    });
});