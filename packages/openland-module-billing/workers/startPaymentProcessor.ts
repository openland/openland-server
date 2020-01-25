import { PaymentMediator } from '../mediators/PaymentMediator';

export function startPaymentProcessor(mediator: PaymentMediator) {
    mediator.paymentProcessorQueue.addWorker(async (item, parent) => {
        await mediator.tryExecutePayment(parent, item.uid, item.pid);
        return { result: 'ok' };
    });
}