import { injectable } from 'inversify';
import { FDB } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { ModernScheduller } from 'openland-module-workers/src/TaskScheduler';
import { Modules } from 'openland-modules/Modules';

type DelayedEvents = 'firstDialogsLoadShort' | 'firstDialogsLoadLong';

@injectable()
export class UserOnboardingModule {

    readonly RearWorker = new WorkQueue<{ type: DelayedEvents, uid: number }, { type: DelayedEvents, uid: number }>('UserOnboardingRear');
    private readonly scheduler = new ModernScheduller();

    start = () => {
        this.scheduler.start();
        // todo implement delayed worker
    }

    //
    // Triggers
    //

    onDialogsLoad = async (ctx: Context, uid: number) => {
        // first time load
        let seq = (await Modules.Messaging.getUserMessagingState(ctx, uid)).seq;
        if (seq === 0) {
            await this.sendMessage(ctx, uid, '[Wellcome]');
            await this.sendToDiscoverIfNeeded(ctx, uid);
            await this.askSendFirstMessageOnFirstLoad(ctx, uid);

        }
    }
    onDiscoverCompleted = async (ctx: Context, uid: number) => {
        await this.askSendFirstMessageAfterDiscover(ctx, uid);
    }


    onTimeoutFired = async (type: DelayedEvents, uid: number) => {

    }

    onMessageSent = async (ctx: Context, uid: number) => {

    }

    sendMessage = async (ctx: Context, uid: number, text: string, path?: string) => {

    }

    //
    // Actions
    //

    // Discover
    private sendToDiscoverIfNeeded = async (ctx: Context, uid: number) => {
        let completedDiscoverWithJoin = this.isDiscoverCOmpletedWithJoin(ctx, uid);
        if (!completedDiscoverWithJoin) {
            await this.sendMessage(ctx, uid, '[Complete Discover]', 'https://openland.com/discover');
        }
    }

    // First message
    private askSendFirstMessageOnFirstLoad = async (ctx: Context, uid: number) => {
        let completedDiscoverWithJoin = this.isDiscoverCOmpletedWithJoin(ctx, uid);
        if (completedDiscoverWithJoin) {
            await this.askSendFirstMessage(ctx, uid);
        }
    }
    private askSendFirstMessageAfterDiscover = async (ctx: Context, uid: number) => {
        if (!await this.userDidSendMessageToGroups(ctx, uid)) {
            await this.askSendFirstMessage(ctx, uid);
        }
    }

    // TODO implement 30 min delay after activation case

    //
    // Utils
    //
    private askSendFirstMessage = async (ctx: Context, uid: number) => {
        // TODO: check send once/user
        await this.sendMessage(ctx, uid, '[Complete Discover]', 'https://openland.com/discover');
    }

    private isDiscoverCOmpletedWithJoin = async (ctx: Context, uid: number) => {
        let chatIds = await Modules.Discover.suggestedChats(ctx, uid);
        let completedDiscoverWithJoin = false;
        for (let cid of chatIds) {
            if (await FDB.UserDialog.findById(ctx, uid, cid)) {
                completedDiscoverWithJoin = true;
                break;
            }
        }
        return completedDiscoverWithJoin;
    }

    private userDidSendMessageToGroups = async (ctx: Context, uid: number) => {
        // TODO implement
        return false;
    }

}