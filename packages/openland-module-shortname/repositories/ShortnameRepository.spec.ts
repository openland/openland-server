import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { createEmptyContext } from 'openland-utils/Context';
import { ShortnameRepository } from './ShortnameRepository';
import { SuperModule } from '../../openland-module-super/SuperModule';
import { UsersModule } from '../../openland-module-users/UsersModule';
import { UserRepository } from '../../openland-module-users/repositories/UserRepository';
import { OrganizationModule } from '../../openland-module-organization/OrganizationModule';
import { OrganizationRepository } from '../../openland-module-organization/repositories/OrganizationRepository';

describe('ShortnameRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('shortnames');
        container.bind(SuperModule).toSelf().inSingletonScope();
        container.bind(UsersModule).toSelf().inSingletonScope();
        container.bind(OrganizationModule).toSelf().inSingletonScope();
        container.bind('UserRepository').to(UserRepository).inSingletonScope();
        container.bind('OrganizationRepository').to(OrganizationRepository).inSingletonScope();
        container.bind('ShortnameRepository').to(ShortnameRepository).inSingletonScope();
    });
    afterAll(() => {
        testEnvironmentEnd();
    });
    it('should set user shortname', async () => {
        let repo = container.get<ShortnameRepository>('ShortnameRepository');
        let ctx = createEmptyContext();
        let res = await repo.setShortnameToUser(ctx, 'hello1', 1);

        expect(res).toEqual(true);

        let shortname = await repo.findUserShortname(ctx, 1);

        expect(shortname).not.toBeNull();
        expect(shortname!.shortname).toEqual('hello1');
    });
    it('should set org shortname', async () => {
        let repo = container.get<ShortnameRepository>('ShortnameRepository');
        let ctx = createEmptyContext();
        let res = await repo.setShortnameToOrganization(ctx, 'hello2', 1, 1);

        expect(res).toEqual(true);

        let shortname = await repo.findOrganizationShortname(ctx, 1);

        expect(shortname).not.toBeNull();
        expect(shortname!.shortname).toEqual('hello2');
    });
    it('should not set already reserved shortname', async (done) => {
        let repo = container.get<ShortnameRepository>('ShortnameRepository');
        let ctx = createEmptyContext();
        let res = await repo.setShortnameToUser(ctx, 'hello3', 1);

        expect(res).toEqual(true);

        try {
            await repo.setShortnameToUser(ctx, 'hello3', 2);
            done.fail();
        } catch (e) {
            done();
        }
    });
    it('should release shortname when changed', async () => {
        let repo = container.get<ShortnameRepository>('ShortnameRepository');
        let ctx = createEmptyContext();
        let res = await repo.setShortnameToUser(ctx, 'hello4', 1);
        res = await repo.setShortnameToUser(ctx, 'hello5', 1);
        res = await repo.setShortnameToUser(ctx, 'hello4', 2);
        expect(res).toEqual(true);
    });
});