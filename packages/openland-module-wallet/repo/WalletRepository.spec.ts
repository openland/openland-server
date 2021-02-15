import { createNamedContext } from '@openland/context';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { WalletRepository } from './WalletRepository';
import { Store } from 'openland-module-db/FDB';
import { inReadOnlyTx } from '@openland/foundationdb';

let rootCtx = createNamedContext('test');

describe('WalletRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('wallet');
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });

    it('should create wallet if needed', async () => {
        let repo = new WalletRepository(Store);
        let wallet = await repo.getWallet(rootCtx, 1);
        expect(wallet.uid).toBe(1);
        expect(wallet.balance).toBe(0);
    });

    it('should perform instant deposits', async () => {
        let repo = new WalletRepository(Store);

        // Check initial balance
        let wallet = await repo.getWallet(rootCtx, 2);
        expect(wallet.balance).toBe(0);

        // Do instant deposit
        await repo.depositInstant(rootCtx, 2, 100);

        // Check wallet Balance
        wallet = await repo.getWallet(rootCtx, 2);
        expect(wallet.balance).toBe(100);

        // Should have one successful transaction in history and zero in pending
        let pending = await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.pending.findAll(ctx, 2));
        let history = await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.history.findAll(ctx, 2));
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
        let pid = 'pid';
        let wallet = await repo.getWallet(rootCtx, 3);
        expect(wallet.balance).toBe(0);

        //
        // Init Deposit
        //

        let txid = await repo.depositAsync(rootCtx, 3, 100, pid);

        // No balance changes
        wallet = await repo.getWallet(rootCtx, 3);
        expect(wallet.balance).toBe(0);

        // Single pending transaction for deposit
        let pending = await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.pending.findAll(ctx, 3));
        let history = await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.history.findAll(ctx, 3));
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
        await expect(repo.depositAsyncCommit(rootCtx, 4, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncCancel(rootCtx, 4, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncFailing(rootCtx, 4, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncActionNeeded(rootCtx, 4, txid)).rejects.toThrowError();
        // Can't apply action non-existent transaction
        await expect(repo.depositAsyncCommit(rootCtx, 3, 'txid')).rejects.toThrowError();
        await expect(repo.depositAsyncCancel(rootCtx, 3, 'txid')).rejects.toThrowError();
        await expect(repo.depositAsyncFailing(rootCtx, 3, 'txid')).rejects.toThrowError();
        await expect(repo.depositAsyncActionNeeded(rootCtx, 3, 'txid')).rejects.toThrowError();
        // Correct operations
        await repo.depositAsyncFailing(rootCtx, 3, txid);
        await repo.depositAsyncActionNeeded(rootCtx, 3, txid);

        // Commit Deposit
        await repo.depositAsyncCommit(rootCtx, 3, txid);

        // Check balance
        wallet = await repo.getWallet(rootCtx, 3);
        expect(wallet.balance).toBe(100);

        // Should have one historical transaction and zero pending
        pending = await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.pending.findAll(ctx, 3));
        history = await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.history.findAll(ctx, 3));
        expect(pending.length).toBe(0);
        expect(history.length).toBe(1);

        tx = history[0];
        expect(tx.uid).toBe(3);
        expect(tx.status).toBe('success');
        expect(tx.operation.type).toBe('deposit');
        expect((tx.operation as any).payment).toBe(pid);
        expect((tx.operation as any).amount).toBe(100);

        // All mutations must throw exception after success
        await expect(repo.depositAsyncCommit(rootCtx, 3, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncCancel(rootCtx, 3, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncFailing(rootCtx, 3, txid)).rejects.toThrowError();
        await expect(repo.depositAsyncActionNeeded(rootCtx, 3, txid)).rejects.toThrowError();

        // Create new deposit for canceling
        txid = await repo.depositAsync(rootCtx, 4, 100, pid);

        // Invalid operation type
        let invalid = await repo.transferAsync(rootCtx, 3, 6, 100, 100, 'pidpid');
        await expect(repo.depositAsyncCommit(rootCtx, 4, invalid.txIn)).rejects.toThrowError();
        await expect(repo.depositAsyncCancel(rootCtx, 4, invalid.txIn)).rejects.toThrowError();
        await expect(repo.depositAsyncFailing(rootCtx, 4, invalid.txIn)).rejects.toThrowError();
        await expect(repo.depositAsyncActionNeeded(rootCtx, 4, invalid.txIn)).rejects.toThrowError();

        // Cancel
        await repo.depositAsyncCancel(rootCtx, 4, txid);

        // Balance should be the same
        wallet = await repo.getWallet(rootCtx, 4);
        expect(wallet.balance).toBe(0);

        // Should have one historical transaction and zero pending one
        pending = await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.pending.findAll(ctx, 4));
        history = await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.history.findAll(ctx, 4));
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

        // Deposit initial
        await repo.depositInstant(rootCtx, 10, 1000);

        // Transfer via wallet balance
        await repo.transferBalance(rootCtx, 10, 11, 100);

        // Balances
        let wallet = await repo.getWallet(rootCtx, 10);
        expect(wallet.balance).toBe(1000 - 100);
        wallet = await repo.getWallet(rootCtx, 11);
        expect(wallet.balance).toBe(100);

        // Sender should have two successful transactions (deposit + transfer)
        let pending = await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.pending.findAll(ctx, 10));
        let history = await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.history.findAll(ctx, 10));
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
        pending = await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.pending.findAll(ctx, 11));
        history = await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.history.findAll(ctx, 11));
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
        await expect(repo.transferBalance(rootCtx, 10, 11, 1000)).rejects.toThrowError('Insufficient funds');

        // Self transfer
        await expect(repo.transferBalance(rootCtx, 10, 10, 1000)).rejects.toThrowError('Unable to transfer to yourself');
    });

    it('should perform instant transfers', async () => {
        let repo = new WalletRepository(Store);

        // Deposit initial
        await repo.depositInstant(rootCtx, 12, 1000);

        // Start Async Transfer
        let pid = 'trs-pid-1';
        let { txOut, txIn } = await repo.transferAsync(rootCtx, 12, 13, 1000, 1000, pid);
        let outTx = (await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.findById(ctx, txOut)))!;
        let inTx = (await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.findById(ctx, txIn)))!;
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
        let wallet = await repo.getWallet(rootCtx, 12);
        expect(wallet.balance).toBe(0);
        wallet = await repo.getWallet(rootCtx, 13);
        expect(wallet.balance).toBe(0);

        // Insufficient funds
        await expect(repo.transferAsync(rootCtx, 12, 13, 1000, 1000, pid)).rejects.toThrowError('Insufficient funds');

        // Self transfer
        await expect(repo.transferAsync(rootCtx, 12, 12, 1000, 1000, pid)).rejects.toThrowError('Unable to transfer to yourself');

        //
        // Possible intermiate changes
        //

        // Can't apply action if user id is invalid
        await expect(repo.transferAsyncCommit(rootCtx, 4, txOut, 5, txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncCancel(rootCtx, 4, txOut, 5, txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncFailing(rootCtx, 4, txOut, 5, txIn, pid)).rejects.toThrowError();
        await expect(repo.transferAsyncActionNeeded(rootCtx, 4, txOut, 5, txIn, pid)).rejects.toThrowError();
        // Can't apply action non-existent transaction
        await expect(repo.transferAsyncCommit(rootCtx, 12, 'txOut', 13, txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncCommit(rootCtx, 12, txOut, 13, 'txIn')).rejects.toThrowError();
        await expect(repo.transferAsyncCancel(rootCtx, 12, 'txOut', 13, txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncCancel(rootCtx, 12, txOut, 13, 'txIn')).rejects.toThrowError();
        await expect(repo.transferAsyncFailing(rootCtx, 12, 'txOut', 13, txIn, pid)).rejects.toThrowError();
        await expect(repo.transferAsyncFailing(rootCtx, 12, txOut, 13, 'txIn', pid)).rejects.toThrowError();
        await expect(repo.transferAsyncActionNeeded(rootCtx, 12, 'txOut', 13, txIn, pid)).rejects.toThrowError();
        await expect(repo.transferAsyncActionNeeded(rootCtx, 12, txOut, 13, 'txIn', pid)).rejects.toThrowError();
        // Correct operations
        await repo.transferAsyncFailing(rootCtx, 12, txOut, 13, txIn, pid);
        await repo.transferAsyncActionNeeded(rootCtx, 12, txOut, 13, txIn, pid);

        //
        // Commit
        //
        await repo.transferAsyncCommit(rootCtx, 12, txOut, 13, txIn);

        // Balances
        wallet = await repo.getWallet(rootCtx, 12);
        expect(wallet.balance).toBe(0);
        wallet = await repo.getWallet(rootCtx, 13);
        expect(wallet.balance).toBe(2000);

        // Transaction states
        outTx = (await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.findById(ctx, txOut)))!;
        inTx = (await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.findById(ctx, txIn)))!;
        expect(outTx.status).toBe('success');
        expect(inTx.status).toBe('success');

        // Operations after completition must fail
        await expect(repo.transferAsyncCommit(rootCtx, 12, txOut, 13, txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncCancel(rootCtx, 12, txOut, 13, txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncFailing(rootCtx, 12, txOut, 13, txIn, pid)).rejects.toThrowError();
        await expect(repo.transferAsyncActionNeeded(rootCtx, 12, txOut, 13, txIn, pid)).rejects.toThrowError();

        //
        // Cancel Test
        //
        let tx2 = await repo.transferAsync(rootCtx, 13, 14, 1000, 100, pid);
        wallet = await repo.getWallet(rootCtx, 13);
        expect(wallet.balance).toBe(1000);
        wallet = await repo.getWallet(rootCtx, 14);
        expect(wallet.balance).toBe(0);

        // Cancel
        await repo.transferAsyncCancel(rootCtx, 13, tx2.txOut, 14, tx2.txIn);

        wallet = await repo.getWallet(rootCtx, 13);
        expect(wallet.balance).toBe(2000);
        wallet = await repo.getWallet(rootCtx, 14);
        expect(wallet.balance).toBe(0);

        // Operations after canceling must fail
        await expect(repo.transferAsyncCommit(rootCtx, 13, tx2.txOut, 14, tx2.txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncCancel(rootCtx, 13, tx2.txOut, 14, tx2.txIn)).rejects.toThrowError();
        await expect(repo.transferAsyncFailing(rootCtx, 13, tx2.txOut, 14, tx2.txIn, pid)).rejects.toThrowError();
        await expect(repo.transferAsyncActionNeeded(rootCtx, 13, tx2.txOut, 14, tx2.txIn, pid)).rejects.toThrowError();
    });

    it('should perform subscription payments', async () => {
        let repo = new WalletRepository(Store);

        // Deposit initial
        await repo.depositInstant(rootCtx, 15, 1000);
        let sid = 'sid';

        // Correct subscription direct payment
        await repo.subscriptionBalance(rootCtx, 15, 100, sid, 1);

        // Check balance
        let wallet = await repo.getWallet(rootCtx, 15);
        expect(wallet.balance).toBe(1000 - 100);

        // Insufficient funds
        await expect(repo.subscriptionBalance(rootCtx, 15, 1000, sid, 1)).rejects.toThrowError();

        // Payment-based
        let txid = await repo.subscriptionPayment(rootCtx, 15, 900, 1000, sid, 2);

        // Check balance
        wallet = await repo.getWallet(rootCtx, 15);
        expect(wallet.balance).toBe(0);

        // Check created transaction
        let tx = (await inReadOnlyTx(rootCtx, async (ctx) => await Store.WalletTransaction.findById(ctx, txid)))!;
        expect(tx.uid).toBe(15);
        expect(tx.status).toBe('pending');
        expect(tx.operation.type).toBe('subscription');
        if (tx.operation.type === 'subscription') {
            expect(tx.operation.subscription).toBe(sid);
            expect(tx.operation.index).toBe(2);
            expect(tx.operation.walletAmount).toBe(900);
            expect(tx.operation.chargeAmount).toBe(1000);
        }

        // Intermediate states
        await repo.subscriptionPaymentFailing(rootCtx, 15, txid, 'pid');
        await repo.subscriptionPaymentActionNeeded(rootCtx, 15, txid, 'pid');

        // Cancel
        await repo.subscriptionPaymentCancel(rootCtx, 15, txid);
        wallet = await repo.getWallet(rootCtx, 15);
        expect(wallet.balance).toBe(900);

        // All operations should throw error after successful transaction
        await expect(repo.subscriptionPaymentCancel(rootCtx, 15, txid)).rejects.toThrowError();
        await expect(repo.subscriptionPaymentCommit(rootCtx, 15, txid)).rejects.toThrowError();
        await expect(repo.subscriptionPaymentActionNeeded(rootCtx, 15, txid, 'pid')).rejects.toThrowError();
        await expect(repo.subscriptionPaymentFailing(rootCtx, 15, txid, 'pid')).rejects.toThrowError();

        // Create and commit
        txid = await repo.subscriptionPayment(rootCtx, 15, 900, 1000, sid, 2);
        await repo.subscriptionPaymentCommit(rootCtx, 15, txid);
        wallet = await repo.getWallet(rootCtx, 15);
        expect(wallet.balance).toBe(0);

        // All operations should throw error after successful transaction
        await expect(repo.subscriptionPaymentCancel(rootCtx, 15, txid)).rejects.toThrowError();
        await expect(repo.subscriptionPaymentCommit(rootCtx, 15, txid)).rejects.toThrowError();
        await expect(repo.subscriptionPaymentActionNeeded(rootCtx, 15, txid, 'pid')).rejects.toThrowError();
        await expect(repo.subscriptionPaymentFailing(rootCtx, 15, txid, 'pid')).rejects.toThrowError();
    });
});