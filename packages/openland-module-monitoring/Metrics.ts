import { WorkQueueRepository } from './../openland-module-workers/repo/WorkQueueRepository';
import { Store } from 'openland-module-db/FDB';
import { MetricFactory } from './MetricFactory';
import { Modules } from '../openland-modules/Modules';
import { ShardState } from 'openland-module-sharding/repo/ShardingRepository';

export const Factory = new MetricFactory();

const DEFAULT_QUANTILES = [0.01, 0.05, 0.5, 0.9, 0.95, 0.99, 0.999];

export const Metrics = {

    //
    // Aplication
    //

    UserActiveServices: Factory.createMachineGauge('user_active_services', 'Active user services'),
    GroupActiveServices: Factory.createMachineGauge('group_active_services', 'Active group services'),

    GroupPresenceSubscriptions: Factory.createTaggedMachineGauge('presences_group_subscriptions', 'Number of group presence subscriptions per machine'),
    UserPresenceSubscriptions: Factory.createTaggedMachineGauge('presences_user_subscriptions', 'Number of user presence subscriptions per machine'),

    //
    // FDB
    //

    FDBTransactionsActive: Factory.createTaggedMachineGauge('fdb_active_transactions', 'Active transactions by machine'),
    FDBTransactionsActiveContext: Factory.createTaggedMachineGauge('fdb_active_transactions_context', 'Active transactions by context'),
    FDBTransactions: Factory.createTaggedFrequencyGauge('fdb_transactions', 'Frequence of transaction by context'),
    FDBErrors: Factory.createTaggedFrequencyGauge('fdb_errors', 'Frequence of various errors'),
    FDBTooOldErrors: Factory.createTaggedFrequencyGauge('fdb_too_old', 'Frequence of too old transaction errors'),
    FDBContextErrors: Factory.createTaggedFrequencyGauge('fdb_errors_context', 'Frequence of transaction errors per context'),
    FDBReads: Factory.createTaggedSummary('fdb_reads', 'Summary of read operations per context', DEFAULT_QUANTILES),
    FDBWrites: Factory.createTaggedSummary('fdb_writes', 'Summary of write operations per context', DEFAULT_QUANTILES),
    FDBReadsFrequency: Factory.createTaggedFrequencyGauge('fdb_reads_fq', 'Frequency of reads per context'),
    FDBWritesFrequency: Factory.createTaggedFrequencyGauge('fdb_writes_fq', 'Frequency of writes per context'),
    FDBQueueDelay: Factory.createSummary('fdb_queue_delay', 'Summary of transaction delay', DEFAULT_QUANTILES),
    FDBQueueSize: Factory.createMachineGauge('fdb_queue_size', 'Size of queue'),

    // SpaceX
    WebSocketConnectionsProcess: Factory.createTaggedMachineGauge('connections_machine', 'Active WebSocket connections per process'),
    WebSocketConnections: Factory.createMachineGauge('connections', 'Active WebSocket connections'),
    WebSocketPacketsIn: Factory.createFrequencyGauge('ws_in_hz', 'WebSocket incoming packets frequency'),
    WebSocketPacketsOut: Factory.createFrequencyGauge('ws_out_hz', 'WebSocket outgoing packets frequency'),
    SpaceXSessions: Factory.createMachineGauge('spacex_sessions', 'Number of active SpaceX sessions'),
    SpaceXSessionsAuthenticated: Factory.createMachineGauge('spacex_sessions_authenticated', 'Number of active authenticated SpaceX sessions'),
    SpaceXSessionsAnonymous: Factory.createMachineGauge('spacex_sessions_anonymous', 'Number of active authenticated SpaceX sessions'),
    SpaceXOperations: Factory.createMachineGauge('spacex_ops', 'Number of active SpaceX operations'),
    SpaceXOperationsFrequence: Factory.createFrequencyGauge('spacex_ops_hz', 'Frequency of SpaceX operations'),
    SpaceXOperationsTaggedFrequence: Factory.createTaggedFrequencyGauge('spacex_ops_hz_tagged', 'Frequency of SpaceX operations'),
    SpaceXOperationsNamedFrequence: Factory.createTaggedFrequencyGauge('spacex_ops_hz_named', 'Frequency of SpaceX operations'),

    SpaceXOperationTime: Factory.createSummary('spacex_operation_duration', 'Duration of SpaceX operation', DEFAULT_QUANTILES),
    SpaceXOperationTimeTagged: Factory.createTaggedSummary('spacex_operation_duration_tagged', 'Duration of SpaceX operation', DEFAULT_QUANTILES),

    SpaceXOperationSubscriptionTime: Factory.createSummary('spacex_operation_subscription_duration', 'Duration of SpaceX operation', DEFAULT_QUANTILES),
    SpaceXOperationSubscriptionTimeTagged: Factory.createTaggedSummary('spacex_operation_subscription_duration_tagged', 'Duration of SpaceX operation', DEFAULT_QUANTILES),

    SpaceXSubscriptions: Factory.createMachineGauge('spacex_sub', 'Number of active SpaceX subscriptions'),
    SpaceXSubscriptionsTagged: Factory.createTaggedMachineGauge('spacex_sub_tagged', 'Number of active SpaceX subscriptions'),
    SpaceXSubscriptionEvents: Factory.createFrequencyGauge('spacex_sub_hz', 'Frequency of SpaceX subscription events'),
    // SpaceXEphemeralTransactions: Factory.createFrequencyGauge('spacex_ephemeral_hz', 'Frequency of ephemeral transactions'),
    SpaceXRetry: Factory.createFrequencyGauge('spacex_retry_hz', 'Frequency of transaction retry'),
    // SpaceXReads: Factory.createSummary('spacex_reads', 'Summary of read operations', DEFAULT_QUANTILES),
    // SpaceXReadsTagged: Factory.createTaggedSummary('spacex_reads_tagged', 'Summary of read operations per tag', DEFAULT_QUANTILES),
    // SpaceXReadsPerQuery: Factory.createSummary('spacex_reads_query', 'Summary of read operations per query', DEFAULT_QUANTILES),
    // SpaceXReadsPerSubscription: Factory.createSummary('spacex_reads_subscription', 'Summary of read operations per subscription', DEFAULT_QUANTILES),
    // SpaceXReadsPerSubscriptionResolve: Factory.createSummary('spacex_reads_subscription_resolve', 'Summary of read operations per subscription resolve', DEFAULT_QUANTILES),
    // SpaceXReadsPerMutation: Factory.createSummary('spacex_reads_mutation', 'Summary of read operations per mutation', DEFAULT_QUANTILES),
    // SpaceXWrites: Factory.createSummary('spacex_writes', 'Summary of write operations', DEFAULT_QUANTILES),
    // SpaceXWritesTagged: Factory.createTaggedSummary('spacex_writes_tagged', 'Summary of read operations per tag', DEFAULT_QUANTILES),
    // SpaceXWritesPerQuery: Factory.createSummary('spacex_writes_query', 'Summary of read operations per query', DEFAULT_QUANTILES),
    // SpaceXWritesPerSubscription: Factory.createSummary('spacex_writes_subscription', 'Summary of read operations per subscription', DEFAULT_QUANTILES),
    // SpaceXWritesPerSubscriptionResolve: Factory.createSummary('spacex_writes_subscription_resolve', 'Summary of read operations per subscription resolve', DEFAULT_QUANTILES),
    // SpaceXWritesPerMutation: Factory.createSummary('spacex_writes_mutation', 'Summary of read operations per mutation', DEFAULT_QUANTILES),

    //
    // Feed Event Engine
    //
    FeedSubscribers: Factory.createPersistedGauge('feed_subscribers', 'Feed Engine subscribers', (ctx) =>
        Modules.Events.mediator.events.repo.stats.getCounter(ctx, 'subscribers')
    ),
    FeedFeeds: Factory.createPersistedGauge('feed_feeds', 'Feed Engine feeds', (ctx) =>
        Modules.Events.mediator.events.repo.stats.getCounter(ctx, 'feeds')
    ),
    FeedSubscriptions: Factory.createPersistedGauge('feed_subscriptions', 'Feed Engine subscriptions', (ctx) =>
        Modules.Events.mediator.events.repo.stats.getCounter(ctx, 'subscriptions')
    ),

    //
    // Sharding
    //
    ShardingNodes: Factory.createTaggedMachineGauge('sharding_nodes', 'Shards per node'),
    ShardingTotal: Factory.createPersistedTaggedGauge('sharding_total', 'Number of shards', async (ctx) => {
        let regions = await Modules.Sharding.getShardRegions(ctx);
        let res: { tag: string, value: number }[] = [];
        for (let r of regions) {
            let allocations = await Modules.Sharding.getAllocations(ctx, r.id);
            let active = 0;
            for (let shard of allocations) {
                active += shard.length;
            }
            res.push({ tag: r.name, value: active });
        }
        return res;
    }),
    ShardingActive: Factory.createPersistedTaggedGauge('sharding_active', 'Number of active shards', async (ctx) => {
        let regions = await Modules.Sharding.getShardRegions(ctx);
        let res: { tag: string, value: number }[] = [];
        for (let r of regions) {
            let allocations = await Modules.Sharding.getAllocations(ctx, r.id);
            let active = 0;
            for (let shard of allocations) {
                for (let allocation of shard) {
                    if (allocation.status === ShardState.ACTIVE) {
                        active++;
                    }
                }
            }
            res.push({ tag: r.name, value: active });
        }
        return res;
    }),
    ShardingRemoving: Factory.createPersistedTaggedGauge('sharding_removing', 'Number of removed shards', async (ctx) => {
        let regions = await Modules.Sharding.getShardRegions(ctx);
        let res: { tag: string, value: number }[] = [];
        for (let r of regions) {
            let allocations = await Modules.Sharding.getAllocations(ctx, r.id);
            let active = 0;
            for (let shard of allocations) {
                for (let allocation of shard) {
                    if (allocation.status === ShardState.REMOVING) {
                        active++;
                    }
                }
            }
            res.push({ tag: r.name, value: active });
        }
        return res;
    }),
    ShardingPending: Factory.createPersistedTaggedGauge('sharding_pending', 'Number of pending shards', async (ctx) => {
        let regions = await Modules.Sharding.getShardRegions(ctx);
        let res: { tag: string, value: number }[] = [];
        for (let r of regions) {
            let allocations = await Modules.Sharding.getAllocations(ctx, r.id);
            let active = 0;
            for (let shard of allocations) {
                for (let allocation of shard) {
                    if (allocation.status === ShardState.ALLOCATING) {
                        active++;
                    }
                }
            }
            res.push({ tag: r.name, value: active });
        }
        return res;
    }),

    //
    // Workers
    //

    WorkerLoopFrequence: Factory.createTaggedFrequencyGauge('worker_loop_frequency', 'Active runtime tasks'),
    WorkerLoopNoTasksFrequence: Factory.createTaggedFrequencyGauge('worker_loop_no_tasks_frequency', 'Loop iteration when no tasks available'),
    WorkerLoopNoWorkersFrequence: Factory.createTaggedFrequencyGauge('worker_loop_no_workers_frequency', 'Loop iteration when no workers available'),
    WorkerActiveRuntime: Factory.createTaggedMachineGauge('worker_active_runtime', 'Active runtime tasks'),
    WorkerAttemptFrequence: Factory.createTaggedFrequencyGauge('worker_attempts', 'Frequency of delivery attempts'),
    WorkerSuccessFrequence: Factory.createTaggedFrequencyGauge('worker_success', 'Frequency of delivery success'),
    WorkerAcquire: Factory.createTaggedSummary('worker_acquire', 'Summary of acquire duration', DEFAULT_QUANTILES),
    WorkerExecute: Factory.createTaggedSummary('worker_execute', 'Summary of execute duration', DEFAULT_QUANTILES),
    WorkerTotal: Factory.createPersistedTaggedGauge('worker_total', 'Total tasks per kind', async (ctx) => {
        let repo = await WorkQueueRepository.open(ctx, Store.storage.db);
        let queues = await repo.listQueues(ctx);
        let res: { tag: string, value: number }[] = [];
        for (let w of queues) {
            res.push({ tag: w.name, value: await repo.getTotal(ctx, w.id) });
        }
        return res;
    }),
    WorkerCompleted: Factory.createPersistedTaggedGauge('worker_completed', 'Completed tasks per kind', async (ctx) => {
        let repo = await WorkQueueRepository.open(ctx, Store.storage.db);
        let queues = await repo.listQueues(ctx);
        let res: { tag: string, value: number }[] = [];
        for (let w of queues) {
            res.push({ tag: w.name, value: await repo.getCompleted(ctx, w.id) });
        }
        return res;
    }),
    WorkerFailures: Factory.createPersistedTaggedGauge('worker_failures', 'Failed tasks per kind', async (ctx) => {
        let repo = await WorkQueueRepository.open(ctx, Store.storage.db);
        let queues = await repo.listQueues(ctx);
        let res: { tag: string, value: number }[] = [];
        for (let w of queues) {
            res.push({ tag: w.name, value: await repo.getFailures(ctx, w.id) });
        }
        return res;
    }),
    WorkerActive: Factory.createPersistedTaggedGauge('worker_active', 'Active tasks per kind', async (ctx) => {
        let repo = await WorkQueueRepository.open(ctx, Store.storage.db);
        let queues = await repo.listQueues(ctx);
        let res: { tag: string, value: number }[] = [];
        for (let w of queues) {
            res.push({ tag: w.name, value: await repo.getActive(ctx, w.id) });
        }
        return res;
    }),
    WorkerPending: Factory.createPersistedTaggedGauge('worker_pending', 'Pending tasks per kind', async (ctx) => {
        let repo = await WorkQueueRepository.open(ctx, Store.storage.db);
        let queues = await repo.listQueues(ctx);
        let res: { tag: string, value: number }[] = [];
        for (let w of queues) {
            res.push({ tag: w.name, value: (await repo.getTotal(ctx, w.id)) - (await repo.getCompleted(ctx, w.id)) });
        }
        return res;
    }),

    //
    // EventBus
    //
    EventsSent: Factory.createFrequencyGauge('events_sent', 'Frequency of a sent events to event bus'),
    EventsReceived: Factory.createFrequencyGauge('events_received', 'Frequency of a sent events to event bus'),

    EventsTaggedSent: Factory.createTaggedFrequencyGauge('events_sent_tagged', 'Frequency of a sent events to event bus tagged by prefix'),
    EventsTaggedReceived: Factory.createTaggedFrequencyGauge('events_received_tagged', 'Frequency of a sent events to event bus tagged by prefix'),

    // NodeJS
    // EventLoopLag: Factory.createTaggedSummary('nodejs_event_loop_lag', 'Summary of event loop lags', DEFAULT_QUANTILES),
    MemoryRss: Factory.createTaggedGauge('nodejs_memory_rss', 'Usage of a memory'),
    MemoryExternal: Factory.createTaggedGauge('nodejs_memory_external', 'Usage of an external memory'),
    MemoryHeapTotal: Factory.createTaggedGauge('nodejs_memory_heap_total', 'Total size of a heap'),
    MemoryHeapUsed: Factory.createTaggedGauge('nodejs_memory_heap_used', 'Used size of a heap'),
    MemoryArrayBuffers: Factory.createTaggedGauge('nodejs_memory_array_buffers', 'Usage of an array buffers'),
    MemoryNative: Factory.createTaggedGauge('nodejs_memory_other', 'Usage of native memory'),

    // Hyperlog
    HyperLogSent: Factory.createFrequencyGauge('hyperlog_writes', 'Frequence of writes to a hyperlog'),
    HyperLogSentTagged: Factory.createTaggedFrequencyGauge('hyperlog_writes_tagged', 'Frequence of writes to a hyperlog'),

    // Presences
    Online: Factory.createGauge('users_online', 'Total online users'),
    OnlineWeb: Factory.createGauge('users_online_web', 'Online Web Users'),
    OnlineIOS: Factory.createGauge('users_online_ios', 'Online iOS Users'),
    OnlineAndroid: Factory.createGauge('users_online_android', 'Online Android Users'),
    OnlineUnknown: Factory.createGauge('users_online_unknwon', 'Online Unknown Users'),

    // Tracing
    // TracingFrequence: Factory.createFrequencyGauge('tracing_span_hz', 'Tracing spans generation frequence'),

    // Basics
    Users: Factory.createPersistedGauge('users_count', 'Total openland users', async (ctx) => {
        let seq = (await Store.Sequence.findById(ctx, 'user-id'));
        if (seq) {
            return seq.value;
        } else {
            return 0;
        }
    }),

    // Calls
    CallWorkers: Factory.createPersistedGauge('calls_workers', 'Number of active workers', async (ctx) => {
        return (await Store.KitchenWorker.active.findAll(ctx)).length;
    }),
    CallRouters: Factory.createPersistedGauge('calls_routers', 'Number of active routers', async (ctx) => {
        let workers = (await Store.KitchenWorker.active.findAll(ctx));
        let res = 0;
        for (let w of workers) {
            res += (await Store.KitchenRouter.workerActive.findAll(ctx, w.id)).length;
        }
        return res;
    }),

    // Debug
    TasksDeletionProgress: Factory.createPersistedGauge('tasks_deletion', 'Completed tasks deletion progress', async ctx => {
        let state = await Store.EntityCleanerState.findById(ctx, 'Task');
        if (state) {
            return state.deletedCount;
        }
        return 0;
    }),
    BrokenTasks: Factory.createPersistedGauge('broken_tasks', 'Count of broken tasks in db', async ctx => {
        let state = await Store.EntityCleanerState.findById(ctx, 'Task');
        if (state) {
            return state.brokenRecordsCount || 0;
        }
        return 0;
    }),
    HyperLogDeletionProgress: Factory.createPersistedGauge('hyperlog_deletion', 'Completed tasks deletion progress', async ctx => {
        let state = await Store.EntityCleanerState.findById(ctx, 'HyperLog');
        if (state) {
            return state.deletedCount;
        }
        return 0;
    }),
    ModernPresenceIndexEstimate: Factory.createPersistedGauge('modern_presence_index_estimate', 'Modern presence reindex estimate', async ctx => {
        return await Store.ReaderEstimate.byId('reader-presences-old').get(ctx);
    }),
    ModernPresenceEstimate: Factory.createPersistedGauge('modern_presence_estimate', 'Modern presence reindex estimate', async ctx => {
        return await Store.ReaderEstimate.byId('presence_log_reader').get(ctx);
    }),

    // Push
    UnreadUsers: Factory.createPersistedGauge('unread_users', 'Unread users count', async (ctx) => {
        return (await Modules.Messaging.needNotificationDelivery.findAllUsersWithNotifications(ctx, 'push')).length;
    }),
    NotificationCenterUnreadUsers: Factory.createPersistedGauge('notification_center_unread_users', 'Unread users count', async (ctx) => {
        return (await Modules.NotificationCenter.needDelivery.findAllUsersWithNotifications(ctx, 'push')).length;
    }),

    // Counters
    GlobalCounterResolveTime: Factory.createSummary('global_counter_resolve_time', 'Summary of global counter fetch time', DEFAULT_QUANTILES),
};