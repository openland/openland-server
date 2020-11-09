import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { countCommission } from '../../openland-module-wallet/repo/utils/countCommission';
import { Modules } from '../../openland-modules/Modules';
import { COMMISSION_PERCENTS } from './PremiumChatMediator';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { MessageInput } from '../MessageInput';
import { injectable } from 'inversify';
import { buildMessage, userMention } from '../../openland-utils/MessageBuilder';
import { formatMoney } from '../../openland-module-wallet/repo/utils/formatMoney';
import { WalletPurchaseCreateShape, Message } from '../../openland-module-db/store';
import { InvalidInputError } from '../../openland-errors/InvalidInputError';
import { inTx } from '@openland/foundationdb';

@injectable()
export class DonationsMediator {
    sendDonationMessage = async (parent: Context, uid: number, cid: number, amount: number, message: MessageInput) => inTx(parent, async (ctx) => {
        let conv = await Store.Conversation.findById(ctx, cid);
        if (!conv) {
            throw new NotFoundError();
        }

        /*
         * Send to DM or rooms' owners
         * */
        let toUid: number;
        if (conv.kind === 'private') {
            let pConv = await Store.ConversationPrivate.findById(ctx, cid);
            if (!pConv) {
                throw new NotFoundError();
            }
            toUid = pConv?.uid1 === uid ? pConv.uid2 : pConv.uid1;
        } else if (conv.kind === 'room') {
            let room = await Store.ConversationRoom.findById(ctx, cid);
            if (!room || !room.ownerId) {
                throw new NotFoundError();
            }
            toUid = room.ownerId;
        } else {
            throw new NotFoundError();
        }

        if (toUid === uid) {
            throw new InvalidInputError([{ message: 'You can\'t donate to yourself', key: 'chatId' }]);
        }

        let purchase = await Modules.Wallet.createPurchase(ctx, uid, amount, {
            type: 'donate_message',
            uid: toUid,
            cid,
            mid: null,
        });

        let m = await Modules.Messaging.sendMessage(ctx, cid, uid!, {
            ...message,
            purchaseId: purchase.id,
        });

        // always true
        if (purchase.product.type === 'donate_message') {
            purchase.product = {
                ...purchase.product,
                mid: m.id
            };
            await purchase.flush(ctx);
        }
    })

    setReaction = async (parent: Context, mid: number, uid: number) => inTx(parent, async (ctx) => {
        let message = await Store.Message.findById(ctx, mid);
        if (!message) {
            return;
        }
        if (uid === message?.uid) {
            throw new InvalidInputError([{ message: 'You can\'t donate to yourself', key: 'messageId' }]);
        }

        if (await Modules.Messaging.setReaction(ctx, mid, uid, 'DONATE')) {
            await Modules.Wallet.createPurchase(ctx, uid, 100, {
                type: 'donate_reaction',
                uid: message.uid,
                mid: message.id,
            });
        }
    })

    onDeleteMessage = async (parent: Context, message: Message) => inTx(parent, async (ctx) => {
        let attachment = message.attachmentsModern?.find(a => a.type === 'purchase_attachment');
        if (!attachment || attachment.type !== 'purchase_attachment') {
            return;
        }
        let purchase = await Store.WalletPurchase.findById(ctx, attachment.pid);
        if (purchase && purchase.state === 'pending' && purchase.pid) {
            let payment = await Store.Payment.findById(ctx, purchase.pid);
            await Modules.Wallet.paymentsMediator.tryCancelPayment(ctx, payment!.id);
        }
    })

    //
    // Purchase
    //
    onPurchaseCreated = async (ctx: Context, pid: string, txid: string, uid: number, amount: number, toUid: number) => {
        let parts = countCommission(amount, COMMISSION_PERCENTS);
        await Modules.Wallet.wallet.incomePending(ctx, txid, toUid, parts.rest, { type: 'purchase', id: pid });
    }

    /**
     * Purchase success - increment balance
     */
    onPurchaseSuccess = async (ctx: Context, pid: string, txid: string, uid: number, amount: number, product: WalletPurchaseCreateShape['product']) => {
        if (product.type !== 'donate_message' && product.type !== 'donate_reaction') {
            return;
        }
        let parts = countCommission(amount, COMMISSION_PERCENTS);
        await Modules.Wallet.wallet.incomeSuccess(ctx, txid, product.uid, parts.rest, { type: 'purchase', id: pid });

        if (product.type === 'donate_reaction') {
            await this.notifyDonee(ctx, product.uid, product.mid!, uid, 'reaction', parts);
        }
    }

    onPurchaseFailing = async (ctx: Context, pid: string, uid: number, amount: number, toUid: number) => {
        // no op
    }

    onPurchaseNeedAction = async (ctx: Context, pid: string, uid: number, amount: number, toUid: number) => {
        // no op
    }

    onPurchaseCanceled = async (ctx: Context, pid: string, uid: number, amount: number, product: WalletPurchaseCreateShape['product']) => {
        if (product.type === 'donate_reaction') {
            await Modules.Messaging.setReaction(ctx, product.mid, uid, 'DONATE', true);
        } else if (product.type === 'donate_message') {
            let message = await Store.Message.findById(ctx, product.mid!);
            if (message?.deleted === false) {
                await Modules.Messaging.deleteMessage(ctx, product.mid!, uid);
            }
        }
    }

    private async notifyDonee(ctx: Context, doneeId: number, mid: number, uid: number, type: 'message' | 'reaction', parts: { commission: number, rest: number, amount: number }) {
        let billyId = await Modules.Super.getEnvVar<number>(ctx, 'onboarding-bot-id');
        if (billyId === null) {
            return;
        }
        let name = await Modules.Users.getUserFullName(ctx, uid);

        let privateChat = await Modules.Messaging.room.resolvePrivateChat(ctx, billyId, doneeId);
        let message = buildMessage(userMention(name, uid), ` just sent you ${formatMoney(parts.amount)} as ${type} donation (income: ${formatMoney(parts.rest)}, commission: ${formatMoney(parts.commission)})`);
        await Modules.Messaging.sendMessage(ctx, privateChat.id, billyId, {
            ...message,
            replyMessages: [mid]
        });
    }
}