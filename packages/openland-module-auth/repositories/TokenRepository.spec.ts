import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { container } from 'openland-modules/Modules.container';
import { TokenRepository } from './TokenRepository';
import { createNamedContext } from '@openland/context';

describe('TokenRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('tokens');
        container.bind('TokenRepository').to(TokenRepository).inSingletonScope();
    });
    afterAll( async () => {
      await  testEnvironmentEnd();
    });
    
    it('should create tokens', async () => {
        let repo = container.get<TokenRepository>('TokenRepository');
        let created = await repo.createToken(createNamedContext('test'), 10000);
        let loaded = await repo.findToken(created.salt);
        expect(loaded).not.toBeNull();
        expect(loaded).not.toBeUndefined();
        expect(loaded!.uid).toBe(10000);
        expect(loaded!.salt).toEqual(created.salt);
    });

    it('should return null for wrong tokens', async () => {
        let repo = container.get<TokenRepository>('TokenRepository');
        let loaded = await repo.findToken('somebadsalt');
        expect(loaded).toBeNull();
    });
});