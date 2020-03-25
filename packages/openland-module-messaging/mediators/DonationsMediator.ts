import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/FDB';
import { countCommission } from '../../openland-module-wallet/repo/utils/countCommission';
import { Modules } from '../../openland-modules/Modules';
import { COMMISSION_PERCENTS } from './PremiumChatMediator';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { MessageInput } from '../MessageInput';
import { injectable } from 'inversify';

@injectable()
export class DonationsMediator {
    sendDonationMessage = async (ctx: Context, uid: number, cid: number, amount: number, message: MessageInput) => {
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
            purchase.product.mid = m.id;
            await purchase.flush(ctx);
        }
    }

    setReaction = async (ctx: Context, mid: number, uid: number) => {
        let message = await Store.Message.findById(ctx, mid);
        if (!message) {
            return;
        }
        if (uid === message?.uid) {
            return;
        }

        if (await Modules.Messaging.setReaction(ctx, mid, uid, 'DONATE')) {
            await Modules.Wallet.createPurchase(ctx, uid, 100, {
                type: 'donate_reaction',
                uid: message.uid,
                mid: message.id,
            });
        }
    }

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
    onPurchaseSuccess = async (ctx: Context, pid: string, txid: string, uid: number, amount: number, toUid: number) => {
        let parts = countCommission(amount, COMMISSION_PERCENTS);
        await Modules.Wallet.wallet.incomeSuccess(ctx, txid, toUid, parts.rest, { type: 'purchase', id: pid });
    }

    onPurchaseFailing = async (ctx: Context, pid: string, uid: number, amount: number, toUid: number) => {
        // no op
    }

    onPurchaseNeedAction = async (ctx: Context, pid: string, uid: number, amount: number, toUid: number) => {
        // no op
    }

    onPurchaseCanceled = async (ctx: Context, pid: string, uid: number, amount: number, toUid: number) => {
        // no op
    }
}