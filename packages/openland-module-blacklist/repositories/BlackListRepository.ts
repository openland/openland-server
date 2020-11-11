import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { encoders, inTx } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { BlackListAddedEvent, BlackListRemovedEvent } from '../../openland-module-db/store';

@injectable()
export class BlackListRepository {
    private blackListDirectory = Store.BlackListDirectoryDirectory
        .withKeyEncoding(encoders.tuple)
        .withValueEncoding(encoders.boolean);

    async banUser(parent: Context, uid: number, banUid: number) {
        return await inTx(parent, async ctx => {
            this.blackListDirectory.set(ctx, [uid, banUid], true);

            // Event for banner
            Store.BlackListEventStore.post(ctx, uid, BlackListAddedEvent.create({
                bannedBy: uid,
                bannedUid: banUid
            }));

            // Event for banned user
            Store.BlackListEventStore.post(ctx, banUid, BlackListAddedEvent.create({
                bannedBy: uid,
                bannedUid: banUid
            }));

            return true;
        });
    }

    async unBanUser(parent: Context, uid: number, unBanUid: number) {
        return await inTx(parent, async ctx => {
            this.blackListDirectory.clear(ctx, [uid, unBanUid]);

            // Event for banner
            Store.BlackListEventStore.post(ctx, uid, BlackListRemovedEvent.create({
                bannedBy: uid,
                bannedUid: unBanUid
            }));

            // Event for banned user
            Store.BlackListEventStore.post(ctx, unBanUid, BlackListRemovedEvent.create({
                bannedBy: uid,
                bannedUid: unBanUid
            }));

            return true;
        });
    }

    async isUserBanned(parent: Context, uid: number, targetUid: number) {
        let res = await this.blackListDirectory.get(parent, [uid, targetUid]);
        return res || false;
    }

    async getUserBlackList(parent: Context, uid: number) {
        return (await this.blackListDirectory.range(parent, [uid])).map(v => v.key[1] as number);
    }
}