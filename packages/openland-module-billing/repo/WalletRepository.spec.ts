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

        // Check initial balance
        let wallet = await repo.getWallet(ctx, 2);
        expect(wallet.balance).toBe(0);

        // Do instant deposit
        await repo.depositInstant(ctx, 2, 100);

        // Check wallet Balance
        wallet = await repo.getWallet(ctx, 2);
        expect(wallet.balance).toBe(100);

        // Should have one successful transaction in history and zero in pending
        let pending = await Store.WalletTransaction.pending.findAll(ctx, 2);
        let history = await Store.WalletTransaction.history.findAll(ctx, 2);
        expect(pending.length).toBe(0);
        expect(history.length).toBe(1);
        let tx = history[0];
        expect(tx.uid).toBe(2);
        expect(tx.status).toBe('success');
        expect(tx.operation.type).toBe('deposit');
        expect((tx.operation as any).payment).toBeNull(); // No payment for instant tx
        expect((tx.operation as any).amount).toBe(100);
    });

    it('should perform async deposits', async () => {
        let repo = new WalletRepository(Store);
        let ctx = createNamedContext('test');
        let pid = 'pid';
        let wallet = await repo.getWallet(ctx, 3);
        expect(wallet.balance).toBe(0);

        //
        // Init Deposit
        //

        let txid = await repo.depositAsync(ctx, 3, 100, pid);

        // No balance changes
        wallet = await repo.getWallet(ctx, 3);
        expect(wallet.balance).toBe(0);

        // Single pending transaction for deposit
        let pending = await Store.WalletTransaction.pending.findAll(ctx, 3);
        let history = await Store.WalletTransaction.history.findAll(ctx, 3);
        expect(pending.length).toBe(1);
        expect(history.length).toBe(0);

        let tx = pending[0];
        expect(tx.uid).toBe(3);
        expect(tx.status).toBe('pending');
        expect(tx.operation.type).toBe('deposit');
        expect((tx.operation as any).payment).toBe(pid);
        expect((tx.operation as any).amount).toBe(100);

        //
        // Possible intermiate changes
        //

        // Can't apply action if user id is invalid
        await expect(repo.depositAsyncCommit(ctx, 4, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncCancel(ctx, 4, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncFailing(ctx, 4, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncActionNeeded(ctx, 4, txid)).rejects.toThrowError();
        // Can't apply action non-existent transaction
        await expect(repo.depositAsyncCommit(ctx, 3, 'txid')).rejects.toThrowError();
        await expect(repo.depositAsyncCancel(ctx, 3, 'txid')).rejects.toThrowError();
        await expect(repo.depositAsyncFailing(ctx, 3, 'txid')).rejects.toThrowError();
        await expect(repo.depositAsyncActionNeeded(ctx, 3, 'txid')).rejects.toThrowError();
        // Correct operations
        await repo.depositAsyncFailing(ctx, 3, txid);
        await repo.depositAsyncActionNeeded(ctx, 3, txid);

        // Commit Deposit
        await repo.depositAsyncCommit(ctx, 3, txid);

        // Check balance
        wallet = await repo.getWallet(ctx, 3);
        expect(wallet.balance).toBe(100);

        // Should have one historical transaction and zero pending
        pending = await Store.WalletTransaction.pending.findAll(ctx, 3);
        history = await Store.WalletTransaction.history.findAll(ctx, 3);
        expect(pending.length).toBe(0);
        expect(history.length).toBe(1);

        tx = history[0];
        expect(tx.uid).toBe(3);
        expect(tx.status).toBe('success');
        expect(tx.operation.type).toBe('deposit');
        expect((tx.operation as any).payment).toBe(pid);
        expect((tx.operation as any).amount).toBe(100);

        // All mutations must throw exception after success
        await expect(repo.depositAsyncCommit(ctx, 3, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncCancel(ctx, 3, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncFailing(ctx, 3, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncActionNeeded(ctx, 3, txid)).rejects.toThrowError();

        // Create new deposit for canceling
        txid = await repo.depositAsync(ctx, 4, 100, pid);

        // Invalid operation type
        let invalid = await repo.transferAsync(ctx, 3, 6, 100, 100, 'pidpid');
        await expect(repo.depositAsyncCommit(ctx, 4, invalid.txIn)).rejects.toThrowError();
        await expect(repo.depositAsyncCancel(ctx, 4, invalid.txIn)).rejects.toThrowError();
        await expect(repo.depositAsyncFailing(ctx, 4, invalid.txIn)).rejects.toThrowError();
        await expect(repo.depositAsyncActionNeeded(ctx, 4, invalid.txIn)).rejects.toThrowError();

        // Cancel
        await repo.depositAsyncCancel(ctx, 4, txid);

        // Balance should be the same
        wallet = await repo.getWallet(ctx, 4);
        expect(wallet.balance).toBe(0);

        // Should have one historical transaction and zero pending one
        pending = await Store.WalletTransaction.pending.findAll(ctx, 4);
        history = await Store.WalletTransaction.history.findAll(ctx, 4);
        expect(pending.length).toBe(0);
        expect(history.length).toBe(1);

        tx = history[0];
        expect(tx.uid).toBe(4);
        expect(tx.status).toBe('canceled');
        expect(tx.operation.type).toBe('deposit');
        expect((tx.operation as any).payment).toBe(pid);
        expect((tx.operation as any).amount).toBe(100);
    });

    it('should perform instant transfers', async () => {
        let repo = new WalletRepository(Store);
        let ctx = createNamedContext('test');

        // Deposit initial
        await repo.depositInstant(ctx, 10, 1000);

        // Transfer via wallet balance
        await repo.transferBalance(ctx, 10, 11, 100);

        // Balances
        let wallet = await repo.getWallet(ctx, 10);
        expect(wallet.balance).toBe(1000 - 100);
        wallet = await repo.getWallet(ctx, 11);
        expect(wallet.balance).toBe(100);

        // Sender should have two successful transactions (deposit + transfer)
        let pending = await Store.WalletTransaction.pending.findAll(ctx, 10);
        let history = await Store.WalletTransaction.history.findAll(ctx, 10);
        expect(pending.length).toBe(0);
        expect(history.length).toBe(2);

        let tx = history[0];
        expect(tx.uid).toBe(10);
        expect(tx.status).toBe('success');
        expect(tx.operation.type).toBe('deposit');
        if (tx.operation.type === 'deposit') {
            expect(tx.operation.payment).toBeNull();
            expect(tx.operation.amount).toBe(1000);
        }

        tx = history[1];
        expect(tx.uid).toBe(10);
        expect(tx.status).toBe('success');
        expect(tx.operation.type).toBe('transfer_out');
        if (tx.operation.type === 'transfer_out') {
            expect(tx.operation.payment.type).toBe('balance');
            expect(tx.operation.toUser).toBe(11);
            expect(tx.operation.chargeAmount).toBe(0);
            expect(tx.operation.walletAmount).toBe(100);
        }

        // Receiver should have one successful transaction
        pending = await Store.WalletTransaction.pending.findAll(ctx, 11);
        history = await Store.WalletTransaction.history.findAll(ctx, 11);
        expect(pending.length).toBe(0);
        expect(history.length).toBe(1);

        tx = history[0];
        expect(tx.uid).toBe(11);
        expect(tx.status).toBe('success');
        expect(tx.operation.type).toBe('transfer_in');
        if (tx.operation.type === 'transfer_in') {
            expect(tx.operation.fromUser).toBe(10);
            expect(tx.operation.amount).toBe(100);
        }

        // Should throw for invalid balances
        await expect(repo.transferBalance(ctx, 10, 11, 1000)).rejects.toThrowError('Insufficient funds');

        // Self transfer
        await expect(repo.transferBalance(ctx, 10, 10, 1000)).rejects.toThrowError('Unable to transfer to yourself');
    });

    it('should perform instant transfers', async () => {
        let repo = new WalletRepository(Store);
        let ctx = createNamedContext('test');

        // Deposit initial
        await repo.depositInstant(ctx, 12, 1000);

        // Start Async Transfer
        let pid = 'trs-pid-1';
        let { txOut, txIn } = await repo.transferAsync(ctx, 12, 13, 1000, 1000, pid);
        let outTx = (await Store.WalletTransaction.findById(ctx, txOut))!;
        let inTx = (await Store.WalletTransaction.findById(ctx, txIn))!;
        expect(outTx.uid).toBe(12);
        expect(inTx.uid).toBe(13);
        expect(outTx.status).toBe('pending');
        expect(inTx.status).toBe('pending');
        expect(outTx.operation.type).toBe('transfer_out');
        if (outTx.operation.type === 'transfer_out') {
            expect(outTx.operation.chargeAmount).toBe(1000);
            expect(outTx.operation.walletAmount).toBe(1000);
            expect(outTx.operation.toUser).toBe(13);
            expect(outTx.operation.payment.type).toBe('payment');
            if (outTx.operation.payment.type === 'payment') {
                expect(outTx.operation.payment.id).toBe(pid);
            }
        }
        expect(inTx.operation.type).toBe('transfer_in');
        if (inTx.operation.type === 'transfer_in') {
            expect(inTx.operation.amount).toBe(2000);
            expect(inTx.operation.fromUser).toBe(12);
        }

        // Balances
        let wallet = await repo.getWallet(ctx, 12);
        expect(wallet.balance).toBe(0);
        wallet = await repo.getWallet(ctx, 13);
        expect(wallet.balance).toBe(0);

        // Insufficient funds
        await expect(repo.transferAsync(ctx, 12, 13, 1000, 1000, pid)).rejects.toThrowError('Insufficient funds');

        // Self transfer
        await expect(repo.transferAsync(ctx, 12, 12, 1000, 1000, pid)).rejects.toThrowError('Unable to transfer to yourself');

        //
        // Possible intermiate changes
        //

        // Can't apply action if user id is invalid
        await expect(repo.transferAsyncCommit(ctx, 4, txOut, 5, txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncCancel(ctx, 4, txOut, 5, txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncFailing(ctx, 4, txOut, 5, txIn, pid)).rejects.toThrowError();
        await expect(repo.transferAsyncActionNeeded(ctx, 4, txOut, 5, txIn, pid)).rejects.toThrowError();
        // Can't apply action non-existent transaction
        await expect(repo.transferAsyncCommit(ctx, 12, 'txOut', 13, txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncCommit(ctx, 12, txOut, 13, 'txIn')).rejects.toThrowError();
        await expect(repo.transferAsyncCancel(ctx, 12, 'txOut', 13, txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncCancel(ctx, 12, txOut, 13, 'txIn')).rejects.toThrowError();
        await expect(repo.transferAsyncFailing(ctx, 12, 'txOut', 13, txIn, pid)).rejects.toThrowError();
        await expect(repo.transferAsyncFailing(ctx, 12, txOut, 13, 'txIn', pid)).rejects.toThrowError();
        await expect(repo.transferAsyncActionNeeded(ctx, 12, 'txOut', 13, txIn, pid)).rejects.toThrowError();
        await expect(repo.transferAsyncActionNeeded(ctx, 12, txOut, 13, 'txIn', pid)).rejects.toThrowError();
        // Correct operations
        await repo.transferAsyncFailing(ctx, 12, txOut, 13, txIn, pid);
        await repo.transferAsyncActionNeeded(ctx, 12, txOut, 13, txIn, pid);

        //
        // Commit
        //
        await repo.transferAsyncCommit(ctx, 12, txOut, 13, txIn);

        // Balances
        wallet = await repo.getWallet(ctx, 12);
        expect(wallet.balance).toBe(0);
        wallet = await repo.getWallet(ctx, 13);
        expect(wallet.balance).toBe(2000);

        // Transaction states
        outTx = (await Store.WalletTransaction.findById(ctx, txOut))!;
        inTx = (await Store.WalletTransaction.findById(ctx, txIn))!;
        expect(outTx.status).toBe('success');
        expect(inTx.status).toBe('success');

        // Operations after completition must fail
        await expect(repo.transferAsyncCommit(ctx, 12, txOut, 13, txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncCancel(ctx, 12, txOut, 13, txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncFailing(ctx, 12, txOut, 13, txIn, pid)).rejects.toThrowError();
        await expect(repo.transferAsyncActionNeeded(ctx, 12, txOut, 13, txIn, pid)).rejects.toThrowError();

        //
        // Cancel Test
        //
        let tx2 = await repo.transferAsync(ctx, 13, 14, 1000, 100, pid);
        wallet = await repo.getWallet(ctx, 13);
        expect(wallet.balance).toBe(1000);
        wallet = await repo.getWallet(ctx, 14);
        expect(wallet.balance).toBe(0);

        // Cancel
        await repo.transferAsyncCancel(ctx, 13, tx2.txOut, 14, tx2.txIn);

        wallet = await repo.getWallet(ctx, 13);
        expect(wallet.balance).toBe(2000);
        wallet = await repo.getWallet(ctx, 14);
        expect(wallet.balance).toBe(0);

        // Operations after canceling must fail
        await expect(repo.transferAsyncCommit(ctx, 13, tx2.txOut, 14, tx2.txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncCancel(ctx, 13, tx2.txOut, 14, tx2.txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncFailing(ctx, 13, tx2.txOut, 14, tx2.txIn, pid)).rejects.toThrowError();
        await expect(repo.transferAsyncActionNeeded(ctx, 13, tx2.txOut, 14, tx2.txIn, pid)).rejects.toThrowError();
    });
});