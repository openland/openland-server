import { createNamedContext } from '@openland/context';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { WalletRepository } from './WalletRepository';
import { Store } from 'openland-module-db/FDB';

describe('WalletRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('wallet');
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });

    it('should create wallet if needed', async () => {
        let repo = new WalletRepository(Store);
        let ctx = createNamedContext('test');
        let wallet = await repo.getWallet(ctx, 1);
        expect(wallet.uid).toBe(1);
        expect(wallet.balance).toBe(0);
    });

    it('should perform instant deposits', async () => {
        let repo = new WalletRepository(Store);
        let ctx = createNamedContext('test');
        let wallet = await repo.getWallet(ctx, 2);
        expect(wallet.balance).toBe(0);
        await repo.depositInstant(ctx, 2, 100);
        wallet = await repo.getWallet(ctx, 2);
        expect(wallet.balance).toBe(100);

        let pending = await Store.WalletTransaction.pending.findAll(ctx, 2);
        let history = await Store.WalletTransaction.history.findAll(ctx, 2);
        expect(pending.length).toBe(0);
        expect(history.length).toBe(1);
        let tx = history[0];
        expect(tx.uid).toBe(2);
        expect(tx.status).toBe('success');
        expect(tx.operation.type).toBe('deposit');
        expect(tx.operation.payment).toBeNull();
        expect(tx.operation.amount).toBe(100);
    });

    it('should perform async deposits', async () => {
        let repo = new WalletRepository(Store);
        let ctx = createNamedContext('test');
        let wallet = await repo.getWallet(ctx, 3);
        let pid = 'pid';
        expect(wallet.balance).toBe(0);

        //
        // Init Deposit
        //

        let txid = await repo.depositAsync(ctx, 3, 100, pid);
    
        wallet = await repo.getWallet(ctx, 3);
        expect(wallet.balance).toBe(0);

        let pending = await Store.WalletTransaction.pending.findAll(ctx, 3);
        let history = await Store.WalletTransaction.history.findAll(ctx, 3);
        expect(pending.length).toBe(1);
        expect(history.length).toBe(0);

        let tx = pending[0];
        expect(tx.uid).toBe(3);
        expect(tx.status).toBe('pending');
        expect(tx.operation.type).toBe('deposit');
        expect(tx.operation.payment).toBe(pid);
        expect(tx.operation.amount).toBe(100);

        //
        // Possible intermiate changes
        //

        // Can't commit if user id is invalid
        await expect(repo.depositAsyncCommit(ctx, 4, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncFailing(ctx, 4, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncActionNeeded(ctx, 4, txid)).rejects.toThrowError();
        // Can't commit non-existent transaction
        await expect(repo.depositAsyncCommit(ctx, 3, 'txid')).rejects.toThrowError();
        await expect(repo.depositAsyncFailing(ctx, 3, 'txid')).rejects.toThrowError();
        await expect(repo.depositAsyncActionNeeded(ctx, 3, 'txid')).rejects.toThrowError();

        //
        // Commit Deposit
        //

        await repo.depositAsyncCommit(ctx, 3, txid);

        wallet = await repo.getWallet(ctx, 3);
        expect(wallet.balance).toBe(100);

        pending = await Store.WalletTransaction.pending.findAll(ctx, 3);
        history = await Store.WalletTransaction.history.findAll(ctx, 3);
        expect(pending.length).toBe(0);
        expect(history.length).toBe(1);

        tx = history[0];
        expect(tx.uid).toBe(3);
        expect(tx.status).toBe('success');
        expect(tx.operation.type).toBe('deposit');
        expect(tx.operation.payment).toBe(pid);
        expect(tx.operation.amount).toBe(100);

        //
        // Mutations after completion
        //

        await expect(repo.depositAsyncCommit(ctx, 3, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncFailing(ctx, 3, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncActionNeeded(ctx, 3, txid)).rejects.toThrowError();
    });
});