import { testEnvironmentStart } from '../../openland-modules/testEnvironment';
import { inTx } from '@openland/foundationdb';
import { createNamedContext } from '@openland/context';
import { ChatsMembersListDirectory } from './ChatsMembersListDirectory';

describe('ChatsMembersListDirectory', () => {
    beforeAll(async () => {
        await testEnvironmentStart('CompactMessagesDirectory');
    });

    it('should add members', async () => {
        let root = createNamedContext('test');
        let directory = new ChatsMembersListDirectory();

        await inTx(root, async ctx => {
            directory.addMember(ctx, 1, 1, false);
            directory.addMember(ctx, 1, 2, true);
            directory.addMember(ctx, 1, 3, false);
            let members = await directory.getChatMembers(ctx, 1);

            expect(members).toEqual([
                { type: 'sync', uid: 1 },
                { type: 'sync', uid: 3 },
                { type: 'async', uid: 2 }
            ]);

            expect(await directory.getUserChats(ctx, 1)).toEqual([ { type: 'sync', cid: 1 } ]);
            expect(await directory.getUserChats(ctx, 2)).toEqual([ { type: 'async', cid: 1 } ]);
            expect(await directory.getUserChats(ctx, 3)).toEqual([ { type: 'sync', cid: 1 } ]);
        });
    });

    it('should remove members', async () => {
        let root = createNamedContext('test');
        let directory = new ChatsMembersListDirectory();

        await inTx(root, async ctx => {
            directory.addMember(ctx, 2, 4, false);
            directory.addMember(ctx, 2, 5, true);
            directory.addMember(ctx, 2, 6, false);
            let members = await directory.getChatMembers(ctx, 2);

            expect(members).toEqual([
                { type: 'sync', uid: 4 },
                { type: 'sync', uid: 6 },
                { type: 'async', uid: 5 }
            ]);

            directory.removeMember(ctx, 2, 4);
            directory.removeMember(ctx, 2, 5);
            directory.removeMember(ctx, 2, 6);

            expect(await directory.getUserChats(ctx, 4)).toEqual([]);
            expect(await directory.getUserChats(ctx, 5)).toEqual([]);
            expect(await directory.getUserChats(ctx, 6)).toEqual([]);
        });
    });
});