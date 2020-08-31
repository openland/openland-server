import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { Modules } from 'openland-modules/Modules';
import { PremiumChatRepository } from 'openland-module-messaging/repositories/PremiumChatRepository';
import { MessagingMediator } from './MessagingMediator';
import { buildMessage, userMention, usersMention, roomMention } from 'openland-utils/MessageBuilder';
import { MessageInput } from 'openland-module-messaging/MessageInput';
import { formatMoney } from 'openland-module-wallet/repo/utils/formatMoney';
import { countCommission } from 'openland-module-wallet/repo/utils/countCommission';

export const COMMISSION_PERCENTS = 10;
@injectable()
export class PremiumChatMediator {

    @lazyInject('PremiumChatRepository')
    private readonly repo!: PremiumChatRepository;
    @lazyInject('MessagingMediator')
    private readonly messaging!: MessagingMediator;

    async createPremiumChatSubscription(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let chat = await Store.ConversationRoom.findById(ctx, cid);
            if (!chat || !chat.ownerId) {
                throw new NotFoundError('Chat owner not found');
            }
            if (!chat.isPremium) {
                throw new Error('Chat is free to join');
            }
            let paidChatSettings = await Store.PremiumChatSettings.findById(ctx, chat.id);
            if (!paidChatSettings) {
                throw new Error('Inconsistent state - chat is paid, but no payment settings found');
            }
            if (!paidChatSettings.interval) {
                throw new Error('You are trying to create subscription for one-time pay group');
            }

            let userPass = await Store.PremiumChatUserPass.findById(ctx, chat.id, uid);
            if (userPass) {
                if (userPass.isActive) {
                    // nothing to do, user already have access
                    throw new Error('User already have access to this chat');
                }
                if (userPass.sid) {
                    let subscription = await Store.WalletSubscription.findById(ctx, userPass.sid);
                    if (subscription && (subscription.state === 'grace_period' || subscription.state === 'retrying' || subscription.state === 'started')) {
                        // user already have active subscription
                        throw new Error('User already have active subscription');
                    }
                }
            }

            let sub = await Modules.Wallet.createSubscription(ctx, uid, paidChatSettings.price, paidChatSettings.interval, { type: 'group', gid: cid });
            await this.alterProChatUserPass(ctx, cid, uid, sub.id);
        });
    }

    async buyPremiumChatPass(parent: Context, cid: number, uid: number) {
        return await inTx(parent, async (ctx) => {
            let chat = await Store.ConversationRoom.findById(ctx, cid);
            if (!chat || !chat.ownerId) {
                throw new NotFoundError('Chat owner not found');
            }
            if (!chat.isPremium) {
                throw new Error('Chat is free to join');
            }
            let paidChatSettings = await Store.PremiumChatSettings.findById(ctx, chat.id);
            if (!paidChatSettings) {
                throw new Error('Inconsistent state - chat is paid, but no payment settings found');
            }
            if (paidChatSettings.interval) {
                throw new Error('You are trying to buy pass to subscription group');
            }

            let userPass = await Store.PremiumChatUserPass.findById(ctx, chat.id, uid);
            if (userPass && userPass.isActive) {
                // nothing to do, user already have access
                throw new Error('User already have access to this chat');
            }

            await Modules.Wallet.createPurchase(ctx, uid, paidChatSettings.price, { type: 'group', gid: cid });
            await this.alterProChatUserPass(ctx, cid, uid, true);
        });
    }

    async alterProChatUserPass(parent: Context, cid: number, uid: number, activeSubscription: string | boolean) {
        return inTx(parent, async (ctx) => {
            let conv = await Store.ConversationRoom.findById(ctx, cid);
            if (!conv) {
                throw new NotFoundError();
            }

            let membershipChanged = await this.repo.alterPaidChatUserPass(ctx, cid, uid, activeSubscription);
            if (membershipChanged) {
                if (activeSubscription) {
                    let prevMessage = await Modules.Messaging.findTopMessage(ctx, cid, uid);

                    if (prevMessage && prevMessage.serviceMetadata && prevMessage.serviceMetadata.type === 'user_invite') {
                        let uids: number[] = prevMessage.serviceMetadata.userIds;
                        uids.push(uid);

                        await this.messaging.editMessage(ctx, prevMessage.id, prevMessage.uid, await this.roomJoinMessage(ctx, uid, uids, true), false);
                        await this.messaging.bumpDialog(ctx, uid, cid);
                    } else {
                        await this.messaging.sendMessage(ctx, uid, cid, await this.roomJoinMessage(ctx, uid, [uid]));
                    }
                } else {
                    await this.messaging.sendMessage(ctx, uid, cid, await this.roomLeaveMessage(ctx, uid), true);
                    await this.messaging.bumpDialog(ctx, uid, cid);
                }

            }
        });
    }

    //
    // Subscriptions
    //

    /**
     * Start subscription
     */
    onSubscriptionStarted = async (ctx: Context, sid: string, txid: string, cid: number, uid: number) => {
        let subscription = (await Store.WalletSubscription.findById(ctx, sid))!;

        let ownerId = (await Store.ConversationRoom.findById(ctx, cid))!.ownerId!;
        let parts = await this.countCommission(ctx, subscription.amount, cid);
        await Modules.Wallet.wallet.incomePending(ctx, txid, ownerId, parts.rest, { type: 'subscription', id: sid });
    }

    /**
     * Payment failing, but subscription is still alive
     */
    onSubscriptionFailing = async (ctx: Context, sid: string, cid: number, uid: number) => {
        // nothing to do, push/email about payment failing should be sent
    }

    /**
     * Payment Period success - increment balance, notify owner
     */
    onSubscriptionPaymentSuccess = async (ctx: Context, sid: string, txid: string, cid: number, uid: number) => {
        let subscription = (await Store.WalletSubscription.findById(ctx, sid))!;
        let ownerId = (await Store.ConversationRoom.findById(ctx, cid))!.ownerId!;
        let parts = await this.countCommission(ctx, subscription.amount, cid);
        await Modules.Wallet.wallet.incomeSuccess(ctx, txid, ownerId, parts.rest, { type: 'subscription', id: sid });
        await this.notifyOwner(ctx, ownerId, cid, uid, 'subscription', parts);
    }

    /**
     * Recovered from failing state
     */
    onSubscriptionRecovered = async (ctx: Context, sid: string, cid: number, uid: number) => {
        await this.alterProChatUserPass(ctx, cid, uid, sid);
    }

    /**
     * Grace Period expired - pause subscription
     */
    onSubscriptionPaused = async (ctx: Context, sid: string, cid: number, uid: number) => {
        await this.alterProChatUserPass(ctx, cid, uid, false);
    }

    /**
     * Subscription restarted
     */
    onSubscriptionRestarted = async (ctx: Context, sid: string, cid: number, uid: number) => {
        await this.alterProChatUserPass(ctx, cid, uid, sid);
    }

    /**
     * Subscription ended
     */
    onSubscriptionExpired = async (ctx: Context, sid: string, cid: number, uid: number) => {
        await this.alterProChatUserPass(ctx, cid, uid, false);
    }

    /**
     * Subscription canceled, but not expired yet
     */
    onSubscriptionCanceled = async (ctx: Context, sid: string, cid: number, uid: number) => {
        // ok then
    }

    //
    // Purchase
    //
    // TODO: Implement full and read-only access
    //
    onPurchaseCreated = async (ctx: Context, pid: string, txid: string, uid: number, amount: number, cid: number) => {
        // Nothing to do, read-only access should be granted by this time
        let ownerId = (await Store.ConversationRoom.findById(ctx, cid))!.ownerId!;
        let parts = await this.countCommission(ctx, amount, cid);
        await Modules.Wallet.wallet.incomePending(ctx, txid, ownerId, parts.rest, { type: 'purchase', id: pid });
    }

    /**
     * Purchase success - increment balance, notify owner
     */
    onPurchaseSuccess = async (ctx: Context, pid: string, txid: string, cid: number, uid: number, amount: number) => {
        // TODO: grant full access here
        let ownerId = (await Store.ConversationRoom.findById(ctx, cid))!.ownerId!;
        let parts = await this.countCommission(ctx, amount, cid);
        await Modules.Wallet.wallet.incomeSuccess(ctx, txid, ownerId, parts.rest, { type: 'purchase', id: pid });
        await this.notifyOwner(ctx, ownerId, cid, uid, 'purchase', parts);
    }

    onPurchaseFailing = async (ctx: Context, pid: string, uid: number, amount: number, cid: number) => {
        // Nothing to do, access should be read-only right after purchase
        // push/email about payment failing should be sent, wallet locked
    }

    onPurchaseNeedAction = async (ctx: Context, pid: string, uid: number, amount: number, cid: number) => {
        // Nothing to do, access should be read-only right after purchase
        // push/email about payment failing should be sent, wallet locked
    }

    onPurchaseCanceled = async (ctx: Context, pid: string, uid: number, amount: number, cid: number) => {
        // How so?
    }

    //
    // Utils
    //

    private async countCommission(ctx: Context, amount: number, cid: number) {
        let chatSettings = await Store.PremiumChatSettings.findById(ctx, cid);
        return countCommission(amount, chatSettings?.commissionPercents || COMMISSION_PERCENTS);
    }

    private async roomJoinMessageText(parent: Context, uids: number[], isUpdate: boolean = false) {
        if (isUpdate) {
            if (uids.length === 2) {
                let name1 = await Modules.Users.getUserFullName(parent, uids[0]);
                let name2 = await Modules.Users.getUserFullName(parent, uids[1]);
                return buildMessage(userMention(name1, uids[0]), ' joined the group along with ', userMention(name2, uids[1]));
            } else {
                let name = await Modules.Users.getUserFullName(parent, uids[0]);

                return buildMessage(userMention(name, uids[0]), ' joined the group along with ', usersMention(`${uids.length - 1} others`, uids.slice(1)));
            }
        }

        if (uids.length === 1) {
            let name = await Modules.Users.getUserFullName(parent, uids[0]);
            return buildMessage(userMention(name, uids[0]), ' joined the group');
        } else if (uids.length === 2) {
            let name1 = await Modules.Users.getUserFullName(parent, uids[0]);
            let name2 = await Modules.Users.getUserFullName(parent, uids[1]);
            return buildMessage(userMention(name1, uids[0]), ' and ', userMention(name2, uids[1]), ' joined the group');
        } else {
            let name = await Modules.Users.getUserFullName(parent, uids[0]);
            return buildMessage(userMention(name, uids[0]), ' joined the group along with ', usersMention(`${uids.length - 1} others`, uids.splice(1)));
        }
    }

    private async roomJoinMessage(parent: Context, uid: number, uids: number[], isUpdate: boolean = false): Promise<MessageInput> {
        return {
            ...await this.roomJoinMessageText(parent, uids, isUpdate),
            isService: true,
            isMuted: true,
            serviceMetadata: {
                type: 'user_invite',
                userIds: uids,
                invitedById: uid
            }
        };
    }

    private async roomLeaveMessage(parent: Context, uid: number): Promise<MessageInput> {
        let name = await Modules.Users.getUserFullName(parent, uid);
        return {
            ...buildMessage(userMention(name, uid), ' left the\u00A0group'),
            isService: true,
            isMuted: true,
            serviceMetadata: {
                type: 'user_kick',
                userId: uid,
                kickedById: uid
            },
        };
    }

    private async notifyOwner(ctx: Context, ownerId: number, gid: number, uid: number, type: 'subscription' | 'purchase', parts: { commission: number, rest: number, amount: number }) {
        let billyId = await Modules.Super.getEnvVar<number>(ctx, 'onboarding-bot-id');
        if (billyId === null) {
            return;
        }
        let user = await Store.UserProfile.findById(ctx, uid);
        if (!user) {
            return;
        }
        let chat = await Store.RoomProfile.findById(ctx, gid);
        if (!chat) {
            return;
        }
        let name = await Modules.Users.getUserFullName(ctx, uid);

        let privateChat = await Modules.Messaging.room.resolvePrivateChat(ctx, billyId, ownerId);
        let message = buildMessage(userMention(name, uid), ` just paid ${formatMoney(parts.amount)} (income: ${formatMoney(parts.rest)}, commission: ${formatMoney(parts.commission)}) for `, roomMention(chat.title, gid), ` access (${type})`);
        await Modules.Messaging.sendMessage(ctx, privateChat.id, billyId, message);
        Modules.Metrics.onBillyBotMessageRecieved(ctx, uid, `premium_chat_${type}_notification`);
    }
}
