import { Store } from 'openland-module-db/FDB';
import { createNamedContext } from '@openland/context';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { PaymentsRepository } from './PaymentsRepository';

describe('PaymentsRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('payments-async');
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });

    it('should create payment', async () => {
        let repo = new PaymentsRepository(Store);
        repo.setRouting({});
        let ctx = createNamedContext('test');

        let payment = await repo.createPayment(ctx, 'pid-1', 1, 100, { type: 'deposit', uid: 1, txid: 'txid' });
        expect(payment.id).toBe('pid-1');
        expect(payment.uid).toBe(1);
        expect(payment.amount).toBe(100);
        expect(payment.operation.type).toBe('deposit');
        expect(payment.operation.type === 'deposit' && payment.operation.uid).toBe(1);
        expect((payment.operation as any).txid).toBe('txid');

        // Double creation
        await expect(repo.createPayment(ctx, 'pid-1', 2, 100, { type: 'deposit', uid: 2, txid: 'txid' })).rejects.toThrowError();
        await expect(repo.createPayment(ctx, 'pid-1', 3, 100, { type: 'deposit', uid: 2, txid: 'txid' })).rejects.toThrowError('uid mismatch');
        await expect(repo.createPayment(ctx, 'pid-1', 3, 100, { type: 'subscription', uid: 2, subscription: 'subs', period: 1, txid: 'txid' })).rejects.toThrowError('uid mismatch');
    });

    it('should handle payment states', async () => {
        let repo = new PaymentsRepository(Store);
        let routeFailingPayment = jest.fn();
        let routeSuccessfulPayment = jest.fn();
        let routeActionNeededPayment = jest.fn();
        let routeCanceledPayment = jest.fn();
        repo.setRouting({
            routeActionNeededPayment: routeActionNeededPayment,
            routeFailingPayment: routeFailingPayment,
            routeSuccessfulPayment: routeSuccessfulPayment,
            routeCanceledPayment: routeCanceledPayment
        });
        let ctx = createNamedContext('test');

        // Create payment
        await repo.createPayment(ctx, 'pid-2', 1, 100, { type: 'deposit', uid: 1, txid: 'txid' });

        // Failing
        await repo.handlePaymentFailing(ctx, 'pid-2');
        let payment = (await Store.Payment.findById(ctx, 'pid-2'))!;
        expect(payment.state).toBe('failing');
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(1);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls[0][1]).toBe(100);
        expect(routeFailingPayment.mock.calls[0][2]).toBe('pid-2');
        expect(routeFailingPayment.mock.calls[0][3].type).toBe('deposit');
        expect(routeFailingPayment.mock.calls[0][3].uid).toBe(1);
        expect(routeFailingPayment.mock.calls[0][3].txid).toBe('txid');

        // Invalid 
        await expect(repo.handlePaymentFailing(ctx, 'pid-2-invalid')).rejects.toThrowError('Unable to find payment');
        await expect(repo.handlePaymentActionRequired(ctx, 'pid-2-invalid')).rejects.toThrowError('Unable to find payment');
        await expect(repo.handlePaymentIntentCanceled(ctx, 'pid-2-invalid')).rejects.toThrowError('Unable to find payment');
        await expect(repo.handlePaymentIntentSuccess(ctx, 'pid-2-invalid')).rejects.toThrowError('Unable to find payment');

        // Second failing
        jest.clearAllMocks();
        await repo.handlePaymentFailing(ctx, 'pid-2');
        payment = (await Store.Payment.findById(ctx, 'pid-2'))!;
        expect(payment.state).toBe('failing');
        // No callbacks called
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);

        // Action Needed
        jest.clearAllMocks();
        await repo.handlePaymentActionRequired(ctx, 'pid-2');
        payment = (await Store.Payment.findById(ctx, 'pid-2'))!;
        expect(payment.state).toBe('action_required');
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(1);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls[0][1]).toBe(100);
        expect(routeActionNeededPayment.mock.calls[0][2]).toBe('pid-2');
        expect(routeActionNeededPayment.mock.calls[0][3].type).toBe('deposit');
        expect(routeActionNeededPayment.mock.calls[0][3].uid).toBe(1);
        expect(routeActionNeededPayment.mock.calls[0][3].txid).toBe('txid');

        // Third failing
        jest.clearAllMocks();
        await repo.handlePaymentFailing(ctx, 'pid-2');
        payment = (await Store.Payment.findById(ctx, 'pid-2'))!;
        expect(payment.state).toBe('action_required'); // No status change
        // No callbacks called
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);

        // Success
        jest.clearAllMocks();
        await repo.handlePaymentIntentSuccess(ctx, 'pid-2');
        payment = (await Store.Payment.findById(ctx, 'pid-2'))!;
        expect(payment.state).toBe('success');
        expect(routeSuccessfulPayment.mock.calls.length).toBe(1);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);
        expect(routeSuccessfulPayment.mock.calls[0][1]).toBe(100);
        expect(routeSuccessfulPayment.mock.calls[0][2]).toBe('pid-2');
        expect(routeSuccessfulPayment.mock.calls[0][3].type).toBe('deposit');
        expect(routeSuccessfulPayment.mock.calls[0][3].uid).toBe(1);
        expect(routeSuccessfulPayment.mock.calls[0][3].txid).toBe('txid');

        // Second Success
        jest.clearAllMocks();
        await repo.handlePaymentIntentSuccess(ctx, 'pid-2');
        payment = (await Store.Payment.findById(ctx, 'pid-2'))!;
        expect(payment.state).toBe('success');
        // No callbacks called
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);

        // Cancel after success: Silent ignore
        jest.clearAllMocks();
        await repo.handlePaymentIntentCanceled(ctx, 'pid-2');
        payment = (await Store.Payment.findById(ctx, 'pid-2'))!;
        expect(payment.state).toBe('success');
        // No callbacks called
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);

        // Failing after success: Silent ignore
        jest.clearAllMocks();
        await repo.handlePaymentFailing(ctx, 'pid-2');
        payment = (await Store.Payment.findById(ctx, 'pid-2'))!;
        expect(payment.state).toBe('success');
        // No callbacks called
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);

        // Action required after success: Silent ignore
        jest.clearAllMocks();
        await repo.handlePaymentActionRequired(ctx, 'pid-2');
        payment = (await Store.Payment.findById(ctx, 'pid-2'))!;
        expect(payment.state).toBe('success');
        // No callbacks called
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);
    });

    it('should handle payment cancelation', async () => {

        let repo = new PaymentsRepository(Store);
        let routeFailingPayment = jest.fn();
        let routeSuccessfulPayment = jest.fn();
        let routeActionNeededPayment = jest.fn();
        let routeCanceledPayment = jest.fn();
        repo.setRouting({
            routeActionNeededPayment: routeActionNeededPayment,
            routeFailingPayment: routeFailingPayment,
            routeSuccessfulPayment: routeSuccessfulPayment,
            routeCanceledPayment: routeCanceledPayment
        });
        let ctx = createNamedContext('test');

        // Create payment
        await repo.createPayment(ctx, 'pid-3', 1, 100, { type: 'deposit', uid: 1, txid: 'txid' });

        // Cancel
        jest.clearAllMocks();
        await repo.handlePaymentIntentCanceled(ctx, 'pid-3');
        let payment = (await Store.Payment.findById(ctx, 'pid-3'))!;
        expect(payment.state).toBe('canceled');
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(1);
        expect(routeCanceledPayment.mock.calls[0][1]).toBe(100);
        expect(routeCanceledPayment.mock.calls[0][2]).toBe('pid-3');
        expect(routeCanceledPayment.mock.calls[0][3].type).toBe('deposit');
        expect(routeCanceledPayment.mock.calls[0][3].uid).toBe(1);
        expect(routeCanceledPayment.mock.calls[0][3].txid).toBe('txid');

        // Double Cancel
        jest.clearAllMocks();
        await repo.handlePaymentIntentCanceled(ctx, 'pid-3');
        payment = (await Store.Payment.findById(ctx, 'pid-3'))!;
        expect(payment.state).toBe('canceled');
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);

        // Success after cancel
        jest.clearAllMocks();
        await expect(repo.handlePaymentIntentSuccess(ctx, 'pid-3')).rejects.toThrowError('Payment already canceled!');
        payment = (await Store.Payment.findById(ctx, 'pid-3'))!;
        expect(payment.state).toBe('canceled');
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);

        // Failing after cancel: Silent ignore
        jest.clearAllMocks();
        await repo.handlePaymentFailing(ctx, 'pid-3');
        payment = (await Store.Payment.findById(ctx, 'pid-3'))!;
        expect(payment.state).toBe('canceled');
        // No callbacks called
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);

        // Action required after cancel: Silent ignore
        jest.clearAllMocks();
        await repo.handlePaymentActionRequired(ctx, 'pid-3');
        payment = (await Store.Payment.findById(ctx, 'pid-3'))!;
        expect(payment.state).toBe('canceled');
        // No callbacks called
        expect(routeSuccessfulPayment.mock.calls.length).toBe(0);
        expect(routeFailingPayment.mock.calls.length).toBe(0);
        expect(routeActionNeededPayment.mock.calls.length).toBe(0);
        expect(routeCanceledPayment.mock.calls.length).toBe(0);
    });
});