import { Context } from '@openland/context';
import { inTx } from '@openland/foundationdb';

export class DiscussionsRepository {
    createDiscussion = async (parent: Context) => {
        return inTx(parent, async ctx => {

        });
    }
}