import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { IntListCollection } from '../../openland-module-db/collections/IntListCollection';
import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { UserError } from '../../openland-errors/UserError';

const FOLLOWING_SUBSPACE = 0;
const FOLLOWERS_SUBSPACE = 1;

@injectable()
export class FollowersRepository {
    public readonly list = new IntListCollection(Store.FollowersDirectory);

    async follow(parent: Context, uid: number, byUid: number) {
        await inTx(parent, async ctx => {
            if (uid === byUid) {
                throw new UserError(`Can\'t follow yourself`);
            }
            // Store in following list
            await this.list.add(ctx, [byUid, FOLLOWING_SUBSPACE], uid);
            // Store in followers list
            await this.list.add(ctx, [uid, FOLLOWERS_SUBSPACE], byUid);
        });
    }

    async unfollow(parent: Context, uid: number, byUid: number) {
        await inTx(parent, async ctx => {
            if (uid === byUid) {
                throw new UserError(`Can\'t unfollow yourself`);
            }
            // Remove from following list
            await this.list.remove(ctx, [byUid, FOLLOWING_SUBSPACE], uid);
            // Remove from followers list
            await this.list.remove(ctx, [uid, FOLLOWERS_SUBSPACE], byUid);
        });
    }

    async getFollowersCount(parent: Context, uid: number) {
        return this.list.count(parent, [uid, FOLLOWERS_SUBSPACE]);
    }

    async getFollowingCount(parent: Context, uid: number) {
        return this.list.count(parent, [uid, FOLLOWING_SUBSPACE]);
    }

    async getFollowersList(parent: Context, uid: number, sort: 'time'|'value', opts?: { limit?: number, after?: string, reverse?: boolean}) {
        return this.list.range(parent, [uid, FOLLOWERS_SUBSPACE], sort, opts);
    }

    async getFollowingList(parent: Context, uid: number, sort: 'time'|'value', opts?: { limit?: number, after?: string, reverse?: boolean}) {
        return this.list.range(parent, [uid, FOLLOWING_SUBSPACE], sort, opts);
    }

    async isFollowing(parent: Context, uid1: number, uid2: number) {
        let ex = await this.list.get(parent, [uid1, FOLLOWING_SUBSPACE], uid2);
        return !!ex;
    }
}