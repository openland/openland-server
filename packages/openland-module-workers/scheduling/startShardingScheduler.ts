import { ShardingRepository } from './../repo/ShardingRepository';
import { Shutdown } from '../../openland-utils/Shutdown';
import { createNamedContext, Context } from '@openland/context';
import { foreverBreakable, delay } from 'openland-utils/timer';

export function startShardingScheduler(repo: ShardingRepository) {
    const root = createNamedContext('sharding-scheduler');
    let workLoop = foreverBreakable(root, async () => {

        // Do scheduling
        await repo.handleScheduling(root);

        await delay(1000);
    });
    const shutdown = async (ctx: Context) => {
        await workLoop.stop();
    };

    Shutdown.registerWork({ name: 'sharding-scheduler', shutdown });
}