import { createHyperlogger, createModernHyperlogger } from './createHyperlogEvent';
import { integer, nullable, string, union } from '../openland-module-clickhouse/schema';

export const Events = {
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
    /*
     * Auth events
     */
    SmsSentEvent: createModernHyperlogger('sms_sent', {
        phone: string(),
    }),

    //
    // ⬇️⬇️⬇️ Old events ⬇️⬇️⬇️
    //
    UserCreated: createHyperlogger<{ uid: number }>('user_created'),
    UserActivated: createHyperlogger<{ uid: number, isTest: boolean }>('user_activated'),
    UserProfileCreated: createHyperlogger<{ uid: number }>('user_profile_created'),

    CallEnded: createHyperlogger<{ duration: number }>('call_ended'),

    EmailSent: createHyperlogger<{ to: string, templateId: string }>('email_sent'),
    EmailFailed: createHyperlogger<{ to: string, templateId: string }>('email_failed'),

    ProfileUpdated: createHyperlogger<{ uid: number }>('profile-updated'),
    OrganizationProfileUpdated: createHyperlogger<{ oid: number }>('organization-profile-updated'),
    OrganizationCreated: createHyperlogger<{ oid: number, uid: number }>('organization-created'),
    SuccessfulInvite: createHyperlogger<{ uid: number, invitedBy: number }>('successful-invite'),

    MembersLog: createHyperlogger<{ rid: number, delta: number }>('room-members-change'),

    MessageNotificationsHandled: createHyperlogger<{ usersCount: number, duration: number }>('message_notifications_handled'),

    PresenceEvent: createHyperlogger<{ uid: number, online: boolean, platform: string | null }>('presence'),

    FirebasePushSent: createHyperlogger<{ uid: number, tokenId: string }>('push_firebase_sent'),
    FirebasePushFailed: createHyperlogger<{ uid: number, tokenId: string, failures: number, error: string, disabled: boolean }>('push_firebase_failed'),
    ApnsPushSent: createHyperlogger<{ uid: number, tokenId: string }>('push_apns_sent'),
    ApnsPushFail: createHyperlogger<{ uid: number, tokenId: string, failures: number, reason: string, disabled: boolean }>('push_apns_failed'),
    WebPushSent: createHyperlogger<{ uid: number, tokenId: string }>('push_web_sent'),
    WebPushFail: createHyperlogger<{ uid: number, tokenId: string, failures: number, statusCode: number, disabled: boolean }>('push_web_failed'),

    StatsNewMobileUserLog: createHyperlogger<{ uid: number, isTest: boolean }>('new-mobile-user'),
    StatsNewSenderLog: createHyperlogger<{ uid: number, isTest: boolean }>('new-sender'),
    StatsNewInvitersLog: createHyperlogger<{ uid: number, inviteeId: number, isTest: boolean }>('new-inviter'),
    StatsNewAboutFillerLog: createHyperlogger<{ uid: number, isTest: boolean }>('new-about-filler'),
    StatsNewThreeLikeGiverLog: createHyperlogger<{ uid: number, isTest: boolean }>('new-three-like-giver'),
    StatsNewThreeLikeGetterLog: createHyperlogger<{ uid: number, isTest: boolean }>('new-three-like-getter'),
    StatsNewReactionLog: createHyperlogger<{ mid: number, messageAuthorId: number, uid: number, isTest: boolean }>('new-reaction')
};