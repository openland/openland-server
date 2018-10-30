import { UpdateReader } from 'openland-server/modules/updateReader';
import { DB } from 'openland-server/tables';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';

export function startMigrator() {
    let reader = new UpdateReader('channel-invite-migrator', 1, DB.ChannelInvite);
    reader.processor(async (items) => {
        for (let i of items) {
            await inTx(async () => {
                if (i.isOneTime) {
                    if (await FDB.ChannelInvitation.findById(i.uuid)) {
                        return;
                    }
                    await FDB.ChannelInvitation.create(i.uuid, {
                        channelId: i.channelId,
                        creatorId: i.creatorId,
                        email: i.forEmail!,
                        firstName: i.memberFirstName,
                        lastName: i.memberLastName,
                        text: i.emailText,
                        enabled: true
                    });
                } else {
                    if (await FDB.ChannelLink.findById(i.uuid)) {
                        return;
                    }
                    await FDB.ChannelLink.create(i.uuid, {
                        channelId: i.channelId,
                        creatorId: i.creatorId,
                        enabled: true
                    });
                }
            });
        }
    });
    reader.start();
}