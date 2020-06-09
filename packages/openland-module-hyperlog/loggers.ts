import { createModernHyperlogger } from './createHyperlogEvent';
import { integer, nullable, string, union } from '../openland-module-clickhouse/schema';

export default {
    /*
     * Task events
     */
    TaskCompleted: createModernHyperlogger('task_completed', {
        taskId: string(),
        taskType: string(),
        duration: integer(),
    }),
    TaskScheduled: createModernHyperlogger('task_scheduled', {
        taskId: string(),
        taskType: string(),
        duration: integer(),
    }),
    /*
     * Wallet events
     */
    PaymentEvent: createModernHyperlogger('wallet_payment_event', {
        type: string(), // payment_success, payment_failing, payment_action_needed, payment_canceled
        uid: integer(),
        amount: integer(),
        pid: string(),
        operation: union({
            deposit: {
                uid: integer(), txid: string()
            }, subscription: {
                uid: integer(), subscription: string(), period: integer(), txid: string(),
            }, transfer: {
                fromUid: integer(), fromTx: string(), toUid: integer(), toTx: string()
            }, purchase: {
                id: string(),
            }
        })
    }),
    PurchaseEvent: createModernHyperlogger('wallet_purchase_event', {
        type: string(), // purchase_created, purchase_successful, purchase_failing, purchase_need_action, purchase_canceled
        pid: string(),
        uid: integer(),
        amount: integer(),
        product: union({
            group: {
                gid: integer()
            },
            donate_message: {
                uid: integer(),
                cid: integer(),
                mid: nullable(integer())
            },
            donate_reaction: {
                uid: integer(),
                mid: integer()
            }
        })
    }),
    SubscriptionEvent: createModernHyperlogger('wallet_subscription_event', {
        /*
          subscription_started, subscription_failing, subscription_payment_success, subscription_recovered,
          subscription_paused, subscription_restarted, subscription_expired, subscription_canceled
        */
        type: string(),
        sid: string(),
        uid: integer(),
        amount: integer(),
        interval: string(), // 'week' | 'month'
        start: integer(),
        state: string(), // 'started' | 'grace_period' | 'retrying' | 'canceled' | 'expired',
        product: union({
            donate: {
                uid: integer(),
            },
            group: {
                gid: integer()
            }
        })
    }),
    PaymentIntentEvent: createModernHyperlogger('wallet_payment_intent_event', {
        type: string(), // payment_intent_success, payment_intent_canceled, payment_intent_need_action, payment_intent_failing
        amount: integer(),
        operation: union({
            deposit: {
                uid: integer()
            },
            payment: {
                id: string()
            },
            purchase: {
                id: string()
            }
        })
    }),
};