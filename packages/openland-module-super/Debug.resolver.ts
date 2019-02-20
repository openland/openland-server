import { GQLResolver } from '../openland-module-api/schema/SchemaSpec';
import { withPermission } from '../openland-module-api/Resolvers';
import { Emails } from '../openland-module-email/Emails';
import { FDB } from '../openland-module-db/FDB';
import { Message } from '../openland-module-db/schema';
import { IDs, IdsFactory } from '../openland-module-api/IDs';
import { Modules } from '../openland-modules/Modules';
import UrlInfoService from '../openland-module-messaging/workers/UrlInfoService';

const URLInfoService = new UrlInfoService();

export default {
    Query: {
        debugParseID: withPermission('super-admin', async (ctx, args) => {
            let id = IdsFactory.resolve(args.id);
            return {
                internalID: id.id,
                type: id.type.typeName
            };
        }),
        debugCrashQuery: () => {
            throw new Error('Test crash!');
        },
        debugUrlInfo: withPermission('super-admin', async (ctx, args) => {
            return URLInfoService.fetchURLInfo(args.url);
        })
    },
    Mutation: {
        debugSendEmail: withPermission('super-admin', async (ctx, args) => {
            let uid = ctx.auth.uid!;
            let oid = ctx.auth.oid!;
            let type = args.type;
            let user = await FDB.User.findById(ctx, uid);
            let email = user!.email!;
            let isProd = process.env.APP_ENVIRONMENT === 'production';

            if (type === 'WELCOME') {
                await Emails.sendWelcomeEmail(ctx, uid);
            } else if (type === 'ACCOUNT_ACTIVATED') {
                await Emails.sendAccountActivatedEmail(ctx, oid, uid);
            } else if (type === 'ACCOUNT_DEACTIVATED') {
                await Emails.sendAccountDeactivatedEmail(ctx, oid, uid);
            } else if (type === 'MEMBER_REMOVED') {
                await Emails.sendMemberRemovedEmail(ctx, oid, uid);
            } else if (type === 'MEMBERSHIP_LEVEL_CHANGED') {
                await Emails.sendMembershipLevelChangedEmail(ctx, oid, uid);
            } else if (type === 'INVITE') {
                let invite = {
                    firstName: 'Test',
                    lastName: 'Test',
                    uid,
                    email: email,
                    entityName: '',
                    id: -1,
                    oid,
                    text: 'test',
                    ttl: -1,
                    enabled: true,
                    joined: false,
                    role: 'MEMBER'
                };

                await Emails.sendInviteEmail(ctx, oid, invite as any);
            } else if (type === 'MEMBER_JOINED') {
                await Emails.sendMemberJoinedEmails(ctx, oid, uid, uid);
            } else if (type === 'SIGNUP_CODE') {
                await Emails.sendActivationCodeEmail(ctx, email, '00000', false);
            } else if (type === 'SIGIN_CODE') {
                await Emails.sendActivationCodeEmail(ctx, email, '00000', true);
            } else if (type === 'UNREAD_MESSAGE') {
                let dialogs = await FDB.UserDialog.rangeFromUserWithCursor(ctx, uid, 10, undefined, true);
                let dialog = dialogs.items[0];
                let messages = await FDB.Message.rangeFromChat(ctx, dialog.cid, 1, true);

                await Emails.sendUnreadMessages(ctx, uid, messages);
            } else if (type === 'UNREAD_MESSAGES') {
                let dialogs = await FDB.UserDialog.rangeFromUserWithCursor(ctx, uid, 10, undefined, true);
                let messages: Message[] = [];

                for (let dialog of dialogs.items) {
                    let msgs = await FDB.Message.rangeFromChat(ctx, dialog.cid, 1, true);
                    messages.push(msgs[0]);
                }

                await Emails.sendUnreadMessages(ctx, uid, messages);
            } else if (type === 'PUBLIC_ROOM_INVITE') {
                let cid = IDs.Conversation.parse(isProd ? 'AL1ZPXB9Y0iq3yp4rx03cvMk9d' : 'd5z2ppJy6JSXx4OA00lxSJXmp6');

                await Emails.sendRoomInviteEmail(ctx, uid, email, cid, { id: 'xxxxx'} as any);
            } else if (type === 'PRIVATE_ROOM_INVITE') {
                let cid = IDs.Conversation.parse(isProd ? 'qljZr9WbMKSRlBZWbDo5U9qZW4' : 'vBDpxxEQREhQyOBB6l7LUDMwPE');

                await Emails.sendRoomInviteEmail(ctx, uid, email, cid, { id: 'xxxxx'} as any);
            } else if (type === 'ROOM_INVITE_ACCEPTED') {
                let cid = IDs.Conversation.parse(isProd ? 'AL1ZPXB9Y0iq3yp4rx03cvMk9d' : 'd5z2ppJy6JSXx4OA00lxSJXmp6');

                let invite = {
                    creatorId: uid,
                    channelId: cid
                };

                await Emails.sendRoomInviteAcceptedEmail(ctx, uid, invite as any);
            }

            return true;
        }),
        debugCreateTestUser: withPermission('super-admin', async (ctx, args) => {
            await Modules.Users.createTestUser(ctx, args.key, args.name);
            return true;
        }),
        debugDeleteUrlInfoCache: withPermission('super-admin', async (ctx, args) => {
            await URLInfoService.deleteURLInfoCache(args.url);
            return true;
        }),
    }
} as GQLResolver;