import { createAugmentationWorker } from './workers/AugmentationWorker';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startEmailNotificationWorker } from './workers/EmailNotificationWorker';
import { startPushNotificationWorker } from './workers/PushNotificationWorker';
import { MessagingRepository } from './repositories/MessagingRepository';
import { FDB } from 'openland-module-db/FDB';
import { ChannelRepository } from './repositories/ChannelRepository';
import { inTx } from 'foundation-orm/inTx';
import { ChannelInviteEmails } from './emails/ChannelInviteEmails';
import { createDeliveryWorker } from './workers/DeliveryWorker';
import { DialogsRepository } from './repositories/DialogsRepository';
import { startMigrator } from './Migrator';
import { FixerRepository } from './repositories/Fixer';
import { RoomRepository } from './repositories/RoomRepository';
import { ConversationRepository } from './repositories/ConversationRepository';

export interface MessageInput {
    repeatToken?: string | null;
    text?: string | null;
    fileId?: string | null;
    fileMetadata?: any | null;
    filePreview?: string | null;
    mentions?: any | null;
    replyMessages?: any | null;
    augmentation?: any | null;
    isMuted: boolean;
    isService: boolean;
}

export class MessagingModule {
    readonly AugmentationWorker = createAugmentationWorker();
    readonly DeliveryWorker = createDeliveryWorker();
    readonly repo = new MessagingRepository(FDB);
    readonly fixer = new FixerRepository(FDB);
    readonly room = new RoomRepository(FDB);
    readonly conv = new ConversationRepository(FDB);
    private readonly dialogs = new DialogsRepository(FDB);
    private readonly channels = new ChannelRepository(FDB);

    start = () => {
        if (serverRoleEnabled('workers')) {
            startEmailNotificationWorker();
        }
        if (serverRoleEnabled('workers')) {
            startPushNotificationWorker();
        }
        if (serverRoleEnabled('workers')) {
            startMigrator();
        }
    }

    async getConversationSettings(uid: number, cid: number) {
        return await this.dialogs.getConversationSettings(uid, cid);
    }

    async resolveInvite(id: string) {
        return await this.channels.resolveInvite(id);
    }

    async createChannelInviteLink(channelId: number, uid: number) {
        return await this.channels.createChannelInviteLink(channelId, uid);
    }

    async refreshChannelInviteLink(channelId: number, uid: number) {
        return await this.channels.refreshChannelInviteLink(channelId, uid);
    }

    async createChannelInvite(channelId: number, uid: number, email: string, emailText?: string, firstName?: string, lastName?: string) {
        return await inTx(async () => {
            let invite = await this.channels.createChannelInvite(channelId, uid, email, emailText, firstName, lastName);
            await ChannelInviteEmails.sendChannelInviteEmail(invite);
            return invite;
        });
    }
}