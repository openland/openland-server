import { InternalTrackEvent } from './Log.resolver';
import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';

export const Events = {

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

    TrackEvent: createHyperlogger<InternalTrackEvent>('track'),

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