import { createNamedContext } from '@openland/context';
import { EndStreamDirectory, StreamInput } from './EndStreamDirectory';
import { Database, inTx } from '@openland/foundationdb';

const rootCtx = createNamedContext('test');

describe('EndStreamDirectory', () => {
    let directory: EndStreamDirectory;

    beforeAll(async () => {
        let db = await Database.openTest({name: 'end-stream-directory', layers: []});
        directory = new EndStreamDirectory(db.allKeys);
    });

    it('should store & update streams', async () => {
        await inTx(rootCtx, async ctx => {
            let input: Required<StreamInput> = {
                pid: 1,
                seq: 2,
                state: 'need-offer',
                localStreams: [
                    {type: 'audio', codec: 'default', mid: '1'}
                ],
                remoteStreams: [
                    {pid: 3, media: {type: 'audio', mid: '2'}}
                ],
                iceTransportPolicy: 'all',
                localSdp: '123',
                remoteSdp: '123',
                localCandidates: ['1', '2', '3'],
                remoteCandidates: ['3', '2', '1']
            };

            directory.createStream(ctx, '1', input);

            let stream = {
                pid: await directory.getPid(ctx, '1'),
                seq: await directory.getSeq(ctx, '1'),
                state: await directory.getState(ctx, '1'),
                localStreams: await directory.getLocalStreams(ctx, '1'),
                remoteStreams: await directory.getRemoteStreams(ctx, '1'),
                iceTransportPolicy: await directory.getIceTransportPolicy(ctx, '1'),
                localSdp: await directory.getLocalSdp(ctx, '1'),
                remoteSdp: await directory.getRemoteSdp(ctx, '1'),
                localCandidates: await directory.getLocalCandidates(ctx, '1'),
                remoteCandidates: await directory.getRemoteCandidates(ctx, '1'),
            };

            expect(stream).toMatchObject(input);

            directory.updateStream(ctx, '1', { state: 'completed' });

            expect(await directory.getState(ctx, '1')).toBe('completed');
        });
    });

    it('should return peer streams', async () => {
        await inTx(rootCtx, async ctx => {
            let savedStreamIds: string[] = [];
            for (let i = 0; i < 10; i++) {
                let id = 'stream-' + i;
                directory.createStream(ctx, id, {
                    pid: 7,
                    seq: 2,
                    state: 'need-offer',
                    localStreams: [
                        {type: 'audio', codec: 'default', mid: '1'}
                    ],
                    remoteStreams: [
                        {pid: 3, media: {type: 'audio', mid: '2'}}
                    ],
                    iceTransportPolicy: 'all',
                    localSdp: '123',
                    remoteSdp: '123',
                    localCandidates: ['1', '2', '3'],
                    remoteCandidates: ['3', '2', '1']
                });
                savedStreamIds.push(id);
            }

            expect(await directory.getPeerStreams(ctx, 7)).toMatchObject(savedStreamIds);
        });
    });
});