import { Store } from 'openland-module-db/FDB';
import { BillingRepository } from './BillingRepository';
import { createNamedContext } from '@openland/context';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';

describe('BillingRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('billing');
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });
    it('should create accounts', async () => {
        let repo = new BillingRepository(Store);
        let ctx = createNamedContext('test');
        let account = await repo.getUserAccount(ctx, 1);
        expect(account.balance).toBe(0);
    });
    it('should create transactions', async () => {
        let repo = new BillingRepository(Store);
        let ctx = createNamedContext('test');

        // Check invalid inputs
        await expect(repo.createTransaction(ctx, 1, 2, 'deposit', 10)).rejects.toThrowError();
        await expect(repo.createTransaction(ctx, null, 2, 'deposit', -1)).rejects.toThrowError();
        await expect(repo.createTransaction(ctx, null, 2, 'deposit', 0)).rejects.toThrowError();
        await expect(repo.createTransaction(ctx, 1, null, 'deposit', 0)).rejects.toThrowError();
        await expect(repo.createTransaction(ctx, null, null, 'deposit', 10)).rejects.toThrowError();

        await expect(repo.createTransaction(ctx, 1, 2, 'withdraw', 10)).rejects.toThrowError();
        await expect(repo.createTransaction(ctx, 2, null, 'withdraw', -1)).rejects.toThrowError();
        await expect(repo.createTransaction(ctx, 2, null, 'withdraw', 0)).rejects.toThrowError();
        await expect(repo.createTransaction(ctx, null, 1, 'withdraw', 0)).rejects.toThrowError();
        await expect(repo.createTransaction(ctx, null, null, 'withdraw', 10)).rejects.toThrowError();

        await expect(repo.createTransaction(ctx, null, null, 'transfer', 10)).rejects.toThrowError();
        await expect(repo.createTransaction(ctx, 2, null, 'transfer', 10)).rejects.toThrowError();
        await expect(repo.createTransaction(ctx, null, 1, 'transfer', 10)).rejects.toThrowError();

        // Create Deposit Transaction
        let tx = await repo.createTransaction(ctx, null, 2, 'deposit', 1002);
        let account = await repo.getUserAccount(ctx, 2);
        expect(account.balance).toBe(0); // Balance is zero since transaction is not completed
        expect(tx.status).toBe('pending');

        // Confirm
        tx = await repo.confirmTransaction(ctx, tx.id);
        await expect(repo.confirmTransaction(ctx, tx.id)).rejects.toThrowError(); // Double confirm
        account = await repo.getUserAccount(ctx, 2);
        expect(account.balance).toBe(1002);
        expect(tx.status).toBe('processed');

        // Create Transfer Transaction
        await expect(repo.createTransaction(ctx, 2, 3, 'transfer', 100000)).rejects.toThrowError(); // Insuficient funds
        tx = await repo.createTransaction(ctx, 2, 3, 'transfer', 10);
        account = await repo.getUserAccount(ctx, 2);
        expect(account.balance).toBe(1002 - 10);
        account = await repo.getUserAccount(ctx, 3);
        expect(account.balance).toBe(10);
        expect(tx.status).toBe('processed');

        // Create Withdraw Transaction
        tx = await repo.createTransaction(ctx, 3, null, 'withdraw', 10);
        account = await repo.getUserAccount(ctx, 3);
        expect(account.balance).toBe(0); // Balance is zero since we tried to withdraw all money
        expect(tx.status).toBe('pending');

        // Cancel
        tx = await repo.cancelTransaction(ctx, tx.id);
        account = await repo.getUserAccount(ctx, 3);
        expect(account.balance).toBe(10);
        expect(tx.status).toBe('canceled');
    });
});