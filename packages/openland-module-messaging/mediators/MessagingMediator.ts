import { EventsMediator } from './EventsMediator';
import { ChatMetricsRepository } from './../repositories/ChatMetricsRepository';
import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { LinkSpan, MessageInput, MessageSpan } from 'openland-module-messaging/MessageInput';
import { MessagesRepository } from 'openland-module-messaging/repositories/MessagesRepository';
import { lazyInject } from 'openland-modules/Modules.container';
import { DeliveryMediator } from './DeliveryMediator';
import { Modules } from 'openland-modules/Modules';
import { AugmentationMediator } from './AugmentationMediator';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { RoomMediator } from './RoomMediator';
import { Context } from '@openland/context';
import { createTracer } from 'openland-log/createTracer';
import { UserError } from '../../openland-errors/UserError';
import { currentTime } from 'openland-utils/timer';
import { createLinkifyInstance } from '../../openland-utils/createLinkifyInstance';
import * as Chrono from 'chrono-node';
import { Store } from 'openland-module-db/FDB';
import { MentionNotificationsMediator } from './MentionNotificationsMediator';
import { DonationsMediator } from './DonationsMediator';
import { UserReadSeqsDirectory } from '../repositories/UserReadSeqsDirectory';
import { NewCountersRepository } from 'openland-module-messaging/counters/NewCountersRepository';

const trace = createTracer('messaging');
const linkifyInstance = createLinkifyInstance();

const BAD_WORDS = [
    'https://t.me/siliconpravdachat',
    't.me/siliconpravdachat',
    'siliconpravdachat',
    'silicon pravda',
    'siliconpravda',
    'li.sten.to/youngtrawmusic',
    'http://li.sten.to/youngtrawmusic',
    'https://li.sten.to/youngtrawmusic',
    'https://music.apple.com/us/album/click-clack-pow-single/1535133993',
];

const CENSORED_WORDS = [
    'fuck', 'faggot',
    'motherfucker',
    'bitch'
];

const ABSOLUTE_SPAM = [
    'music.apple.com/us/album/click-clack-pow-single/1535133993',
    'li.sten.to/youngtrawmusic',
    'https://music.apple.com/us/artist/young-traw/1515795274'
];

function censor(text: string) {
    let res = text;
    for (let word of BAD_WORDS) {
        let index: number = -1;
        while ((index = text.toLowerCase().indexOf(word, index + 1)) !== -1) {
            res = res.slice(0, index)
                + word.split(' ').map(a => new Array(a.length + 1).join('*')).join(' ')
                + res.slice(index + word.length);
        }
    }

    for (let word of CENSORED_WORDS) {
        let index: number = -1;
        while ((index = text.toLowerCase().indexOf(word, index + 1)) !== -1) {
            res = res.slice(0, index)
                + word.split(' ').map(a => a[0] + new Array(a.length - 1).join('*') + a[a.length - 1]).join(' ')
                + res.slice(index + word.length);
        }
    }
    return res;
}

function spamCheck(text: string) {
    text = text.toLowerCase();

    for (let word of ABSOLUTE_SPAM) {
        if (text.indexOf(word) > -1) {
            return true;
        }
    }

    return false;
}

@injectable()
export class MessagingMediator {

    @lazyInject('MessagesRepository')
    private readonly repo!: MessagesRepository;
    @lazyInject('MessagingEventsMediator')
    readonly events!: EventsMediator;

    @lazyInject('DeliveryMediator')
    private readonly delivery!: DeliveryMediator;
    @lazyInject('AugmentationMediator')
    private readonly augmentation!: AugmentationMediator;
    @lazyInject('MentionNotificationsMediator')
    private readonly mentionNotifications!: MentionNotificationsMediator;
    @lazyInject('RoomMediator')
    private readonly room!: RoomMediator;
    @lazyInject('DonationsMediator')
    private readonly donations!: DonationsMediator;
    @lazyInject('UserReadSeqsDirectory')
    readonly userReadSeqs!: UserReadSeqsDirectory;
    @lazyInject('ChatMetricsRepository')
    private readonly chatMetrics!: ChatMetricsRepository;
    // New counters
    readonly counters = new NewCountersRepository(Store.MessageCountersDirectory);

    sendMessage = async (parent: Context, uid: number, cid: number, message: MessageInput, skipAccessCheck?: boolean) => {
        return trace.trace(parent, 'sendMessage', async (ctx2) => await inTx(ctx2, async (ctx) => {
            if ((message.message === null || message.message === undefined || message.message.trim().length === 0)
                && !(message.replyMessages && message.replyMessages.length)
                && !message.stickerId && !message.purchaseId
                && !(message.attachments && message.attachments.length)
            ) {
                throw new UserError('Can\'t send empty message');
            }
            // Check for bad words. Useful for debug.
            if (message.message === 'fuck') {
                throw Error('');
            }

            if (message.message) {
                if (spamCheck(message.message)) {
                    throw new AccessDeniedError();
                }
                message.message = censor(message.message);
            }

            // Read conversation
            let conv = await Store.Conversation.findById(ctx, cid);
            if (!conv) {
                throw new AccessDeniedError();
            }

            // Permissions
            if (!skipAccessCheck) {
                await this.room.checkAccess(ctx, uid, cid);
                if (conv.deleted) {
                    throw new AccessDeniedError();
                }
                if (conv && conv.archived) {
                    throw new AccessDeniedError();
                }
                if (conv && conv.kind === 'room' && !(await this.room.checkCanSendMessage(ctx, cid, uid))) {
                    throw new AccessDeniedError();
                }
            }

            let msg = message;

            // /me service message
            if (message.message && message.message.startsWith('/me ')) {
                let user = (await Store.UserProfile.findById(ctx, uid))!;
                let userMentionStr = `@` + [user.firstName, user.lastName].filter(a => !!a).join(' ');
                let lengthDiff = userMentionStr.length - 3;
                msg = {
                    message: userMentionStr + message.message.substring(3, message.message.length),
                    isService: true,
                    spans: [{ type: 'user_mention', offset: 0, length: userMentionStr.length, user: uid }, ...(msg.spans || []).map(s => ({ ...s, offset: s.offset + lengthDiff }))],
                    repeatKey: msg.repeatKey
                };
            }

            let room = await Store.RoomProfile.findById(ctx, cid);

            // Replace only-replies messages with original ones
            if (message.replyMessages) {
                for (let i = message.replyMessages.length - 1; i >= 0; i--) {
                    let replyMessage = message.replyMessages[i];
                    let originalMessage = await Store.Message.findById(ctx, replyMessage);
                    if (room && room.repliesDisabled && originalMessage?.cid === cid) {
                        message.replyMessages.splice(i, 1);
                        continue;
                    }

                    if (
                        originalMessage &&
                        originalMessage.replyMessages &&
                        !originalMessage.attachments &&
                        !originalMessage.attachmentsModern &&
                        !originalMessage.augmentation &&
                        !originalMessage.text &&
                        !originalMessage.stickerId &&
                        !originalMessage.buttons &&
                        !originalMessage.title
                    ) {
                        message.replyMessages.splice(i, 1, ...originalMessage.replyMessages);
                    }
                }
            }

            let spans = msg.spans ? [...msg.spans] : [];
            //
            // Parse links
            //
            if (!msg.isService) {
                let links = this.parseLinks(msg.message || '');
                if (links.length > 0) {
                    spans.push(...links);
                }
            }

            // Parse hashtags
            if (!msg.isService) {
                spans.push(...this.parseHashTags(msg.message || ''));
            }

            //
            // Parse dates
            //
            let dates = this.parseDates(msg.message || '');
            if (dates.length > 0) {
                spans.push(...dates);
            }

            //
            // Persist custom avatar
            //
            if (msg.overrideAvatar) {
                await Modules.Media.saveFile(ctx, msg.overrideAvatar.uuid);
            }

            // Create
            let res = await this.repo.createMessage(ctx, cid, uid, { ...msg, spans });

            // Update counters
            await this.counters.onMessage(ctx, res.message);

            // Post Event
            if (conv!.kind === 'private') {
                let p = (await Store.ConversationPrivate.findById(ctx, cid))!;
                await this.events.onPrivateMessageSent(ctx, cid, res.message.id, uid, res.message.visibleOnlyForUids || [], [p.uid1, p.uid2]);
            } else {
                await this.events.onGroupMessageSent(ctx, cid, res.message.id, uid, res.message.visibleOnlyForUids || []);
            }

            //
            // Update user counter
            //
            if (!message.isService) {
                this.chatMetrics.onMessageSent(ctx, uid);
                await Modules.Stats.onMessageSent(ctx, uid);
            }
            let direct = conv && conv.kind === 'private';
            if (direct) {
                await this.chatMetrics.onMessageSentDirect(ctx, uid, cid);
            } else {
                await Modules.Stats.onRoomMessageSent(ctx, cid);
            }

            //
            // Notify hooks
            //

            await Modules.Hooks.onMessageSent(ctx, uid);

            //
            // Delivery
            //

            await this.delivery.onNewMessage(ctx, res.message);

            if (res.message.seq) {
                await this.userReadSeqs.updateReadSeq(ctx, uid, cid, res.message.seq);
            }

            // Mentions
            await this.mentionNotifications.onNewMessage(ctx, res.message);

            if (!message.isService) {
                // Subscribe to comments
                await Modules.Comments.notificationsMediator.onNewPeer(ctx, 'message', res.message.id, uid, message.spans || []);
            }

            if (!msg.ignoreAugmentation) {
                // Augment
                this.augmentation.onNewMessage(ctx, res.message);
            }

            return res.message;
        }));
    }

    bumpDialog = async (parent: Context, uid: number, cid: number) => {
        return trace.trace(parent, 'bumpDialog', async (ctx2) => await inTx(ctx2, async (ctx) => {
            await this.delivery.onDialogBump(ctx, uid, cid, currentTime());
        }));
    }

    editMessage = async (parent: Context, mid: number, uid: number, newMessage: MessageInput, markAsEdited: boolean, augmentation: boolean = false) => {
        return await inTx(parent, async (ctx) => {
            if (newMessage.message !== null && newMessage.message !== undefined && newMessage.message!.trim().length === 0) {
                throw new UserError('Can\'t edit empty message');
            }

            // Permissions
            let message = (await Store.Message.findById(ctx, mid!))!;

            if (message.uid !== uid) {
                if (await Modules.Super.superRole(ctx, uid) !== 'super-admin') {
                    throw new AccessDeniedError();
                }
            }

            // Read conversation
            let conv = await Store.Conversation.findById(ctx, message.cid);
            if (!conv) {
                throw new AccessDeniedError();
            }

            let spans: MessageSpan[] | null = null;

            if (newMessage.message) {
                newMessage.message = censor(newMessage.message);

                spans = newMessage.spans ? [...newMessage.spans] : [];

                //
                // Parse links
                //
                let links = this.parseLinks(newMessage.message || '');
                if (links.length > 0) {
                    spans.push(...links);
                }

                //
                // Parse dates
                //
                let dates = this.parseDates(newMessage.message || '');
                if (dates.length > 0) {
                    spans.push(...dates);
                }

                // Parse hashtags
                spans.push(...this.parseHashTags(newMessage.message || ''));
            }

            // Update
            let res = await this.repo.editMessage(ctx, mid, { ...newMessage, ... (spans ? { spans } : {}) }, markAsEdited);
            message = (await Store.Message.findById(ctx, mid!))!;

            // Update counters
            await this.counters.onMessage(ctx, message);

            // Post Event
            if (conv!.kind === 'private') {
                let p = (await Store.ConversationPrivate.findById(ctx, conv.id))!;
                await this.events.onPrivateMessageUpdated(ctx, conv.id, mid, uid, message.visibleOnlyForUids || [], [p.uid1, p.uid2]);
            } else {
                await this.events.onGroupMessageUpdated(ctx, conv.id, mid, uid, message.visibleOnlyForUids || []);
            }

            // Delivery
            await this.delivery.onUpdateMessage(ctx, message);

            // Mentions
            await this.mentionNotifications.onMessageUpdated(ctx, message);

            // Send notification center updates
            await Modules.NotificationCenter.onCommentPeerUpdated(ctx, 'message', message.id, null);

            if (!newMessage.ignoreAugmentation && !augmentation) {
                // Augment
                this.augmentation.onMessageUpdated(ctx, message);
            }

            return res;
        });
    }

    markMessageUpdated = async (parent: Context, mid: number) => {
        await inTx(parent, async (ctx) => {
            let message = await Store.Message.findById(ctx, mid);
            if (!message) {
                throw new Error('Message not found');
            }

            // Read conversation
            let conv = await Store.Conversation.findById(ctx, message.cid);
            if (!conv) {
                throw new AccessDeniedError();
            }

            // Post event
            if (conv!.kind === 'private') {
                let p = (await Store.ConversationPrivate.findById(ctx, conv.id))!;
                await this.events.onPrivateMessageUpdated(ctx, conv.id, mid, message.uid, message.visibleOnlyForUids || [], [p.uid1, p.uid2]);
            } else {
                await this.events.onGroupMessageUpdated(ctx, conv.id, mid, message.uid, message.visibleOnlyForUids || []);
            }
        });
    }

    setReaction = async (parent: Context, mid: number, uid: number, reaction: string, reset: boolean = false) => {
        return await inTx(parent, async (ctx) => {
            // Update
            let res = await this.repo.setReaction(ctx, mid, uid, reaction, reset);

            if (!res) {
                return false;
            }

            // Read conversation
            let conv = await Store.Conversation.findById(ctx, res.cid);
            if (!conv) {
                throw new AccessDeniedError();
            }

            // Post event
            if (conv!.kind === 'private') {
                let p = (await Store.ConversationPrivate.findById(ctx, conv.id))!;
                await this.events.onPrivateMessageUpdated(ctx, conv.id, mid, res.uid, res.visibleOnlyForUids || [], [p.uid1, p.uid2]);
            } else {
                await this.events.onGroupMessageUpdated(ctx, conv.id, mid, res.uid, res.visibleOnlyForUids || []);
            }

            // Stats
            if (!reset) {
                await Modules.Stats.onReactionSet(ctx, res, uid);
            }

            // Delivery
            // let message = (await Store.Message.findById(ctx, mid))!;
            // await this.delivery.onUpdateMessage(ctx, message);

            return res;
        });
    }

    deleteMessage = async (parent: Context, mid: number, uid: number) => {
        await inTx(parent, async (ctx) => {

            let message = (await Store.Message.findById(ctx, mid!))!;
            if (message.uid !== uid) {
                if (!(await this.room.userHaveAdminPermissionsInRoom(ctx, uid, message.cid))) {
                    throw new AccessDeniedError();
                }
            }

            // Delete
            await this.repo.deleteMessage(ctx, mid);

            // Read conversation
            let conv = await Store.Conversation.findById(ctx, message.cid);
            if (!conv) {
                throw new AccessDeniedError();
            }

            // Post event
            if (conv!.kind === 'private') {
                let p = (await Store.ConversationPrivate.findById(ctx, conv.id))!;
                await this.events.onPrivateMessageDeleted(ctx, conv.id, mid, message.uid, message.visibleOnlyForUids || [], [p.uid1, p.uid2]);
            } else {
                await this.events.onGroupMessageDeleted(ctx, conv.id, mid, message.uid, message.visibleOnlyForUids || []);
            }

            // Delivery
            message = (await Store.Message.findById(ctx, mid))!;
            await this.delivery.onDeleteMessage(ctx, message);

            // Update counters
            await this.counters.onMessage(ctx, message);

            // cancel payment if it is not success/canceled
            await this.donations.onDeleteMessage(ctx, message);

            let chatProfile = await Store.RoomProfile.findById(ctx, message.cid);
            if (chatProfile && chatProfile.pinnedMessage && chatProfile.pinnedMessage === message.id) {
                await this.room.unpinMessage(ctx, message.cid, uid);
            }

            // Send notification center updates
            await Modules.NotificationCenter.onCommentPeerUpdated(ctx, 'message', message.id, null);
        });
    }

    deleteMessages = async (parent: Context, mids: number[], uid: number) => {
        await inTx(parent, async (ctx) => {
            for (let mid of mids) {
                await this.deleteMessage(ctx, mid, uid);
            }
        });
    }

    readRoom = async (parent: Context, uid: number, cid: number, mid: number) => {
        await inTx(parent, async (ctx) => {
            let msg = await Store.Message.findById(ctx, mid);
            if (!msg || msg.cid !== cid) {
                throw Error('Invalid request');
            }
            await this.delivery.onRoomRead(ctx, uid, mid);

            if (msg.seq) {
                await this.userReadSeqs.updateReadSeq(ctx, uid, cid, msg.seq);
            }
        });
    }

    //
    // Queries
    //

    findTopMessage = async (ctx: Context, cid: number, forUid: number) => {
        return await this.repo.findTopMessage(ctx, cid, forUid);
    }

    private parseLinks(message: string): MessageSpan[] {
        let urls = linkifyInstance.match(message);

        if (!urls) {
            return [];
        }

        let offsets = new Set<number>();

        function getOffset(str: string, n: number = 0): number {
            let offset = message.indexOf(str, n);

            if (offsets.has(offset)) {
                return getOffset(str, n + 1);
            }

            offsets.add(offset);
            return offset;
        }

        return urls.map(url => ({
            type: 'link',
            offset: getOffset(url.raw),
            length: url.raw.length,
            url: url.url,
        } as LinkSpan));
    }

    private parseDates(message: string): MessageSpan[] {
        let parsed = Chrono.parse(message, new Date());

        return parsed.map(part => {
            return {
                type: 'date_text',
                offset: part.index,
                length: part.text.length,
                date: part.start.date().getTime()
            };
        });
    }

    private parseHashTags(message: string): MessageSpan[] {
        let res: MessageSpan[] = [];
        let hashTagRegexp = /#([a-zA-Zа-яА-ЯёЁ\d_]+)/gm;
        let match: RegExpExecArray | null;

        while ((match = hashTagRegexp.exec(message))) {
            res.push({
                type: 'hash_tag',
                offset: match.index,
                length: match[0].length,
                tag: match[1]
            });
        }

        return res;
    }
}
