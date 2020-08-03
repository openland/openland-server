import { Store } from 'openland-module-db/FDB';
import { MetricFactory } from './MetricFactory';
import { Modules } from '../openland-modules/Modules';

export const Factory = new MetricFactory();

const DEFAULT_QUANTILES = [0.01, 0.05, 0.5, 0.9, 0.95, 0.99, 0.999];

export const Metrics = {

    // SpaceX
    WebSocketConnections: Factory.createMachineGauge('connections', 'Active WebSocket connections'),
    WebSocketPacketsIn: Factory.createFrequencyGauge('ws_in_hz', 'WebSocket incoming packets frequency'),
    WebSocketPacketsOut: Factory.createFrequencyGauge('ws_out_hz', 'WebSocket outgoing packets frequency'),
    SpaceXSessions: Factory.createMachineGauge('spacex_sessions', 'Number of active SpaceX sessions'),
    SpaceXSessionsAuthenticated: Factory.createMachineGauge('spacex_sessions_authenticated', 'Number of active authenticated SpaceX sessions'),
    SpaceXSessionsAnonymous: Factory.createMachineGauge('spacex_sessions_anonymous', 'Number of active authenticated SpaceX sessions'),
    SpaceXOperations: Factory.createMachineGauge('spacex_ops', 'Number of active SpaceX operations'),
    SpaceXOperationsFrequence: Factory.createFrequencyGauge('spacex_ops_hz', 'Frequency of SpaceX operations'),
    SpaceXOperationTime: Factory.createSummary('spacex_operation_duration', 'Duration of SpaceX operation', DEFAULT_QUANTILES),
    SpaceXOperationTimeTagged: Factory.createTaggedSummary('spacex_operation_duration_tagged', 'Duration of SpaceX operation', DEFAULT_QUANTILES),
    SpaceXSubscriptions: Factory.createMachineGauge('spacex_sub', 'Number of active SpaceX subscriptions'),
    SpaceXSubscriptionEvents: Factory.createFrequencyGauge('spacex_sub_hz', 'Frequency of SpaceX subscription events'),
    SpaceXEphemeralTransactions: Factory.createFrequencyGauge('spacex_ephemeral_hz', 'Frequency of ephemeral transactions'),
    SpaceXRetry: Factory.createFrequencyGauge('spacex_retry_hz', 'Frequency of transaction retry'),
    SpaceXReads: Factory.createSummary('spacex_reads', 'Summary of read operations', DEFAULT_QUANTILES),
    SpaceXReadsTagged: Factory.createTaggedSummary('spacex_reads_tagged', 'Summary of read operations per tag', DEFAULT_QUANTILES),
    SpaceXReadsPerQuery: Factory.createSummary('spacex_reads_query', 'Summary of read operations per query', DEFAULT_QUANTILES),
    SpaceXReadsPerSubscription: Factory.createSummary('spacex_reads_subscription', 'Summary of read operations per subscription', DEFAULT_QUANTILES),
    SpaceXReadsPerSubscriptionResolve: Factory.createSummary('spacex_reads_subscription_resolve', 'Summary of read operations per subscription resolve', DEFAULT_QUANTILES),
    SpaceXReadsPerMutation: Factory.createSummary('spacex_reads_mutation', 'Summary of read operations per mutation', DEFAULT_QUANTILES),
    SpaceXWrites: Factory.createSummary('spacex_writes', 'Summary of write operations', DEFAULT_QUANTILES),
    SpaceXWritesTagged: Factory.createTaggedSummary('spacex_writes_tagged', 'Summary of read operations per tag', DEFAULT_QUANTILES),
    SpaceXWritesPerQuery: Factory.createSummary('spacex_writes_query', 'Summary of read operations per query', DEFAULT_QUANTILES),
    SpaceXWritesPerSubscription: Factory.createSummary('spacex_writes_subscription', 'Summary of read operations per subscription', DEFAULT_QUANTILES),
    SpaceXWritesPerSubscriptionResolve: Factory.createSummary('spacex_writes_subscription_resolve', 'Summary of read operations per subscription resolve', DEFAULT_QUANTILES),
    SpaceXWritesPerMutation: Factory.createSummary('spacex_writes_mutation', 'Summary of read operations per mutation', DEFAULT_QUANTILES),

    //
    // Workers
    //
    
    WorkerAttemptFrequence: Factory.createTaggedFrequencyGauge('worker_attempts', 'Frequency of delivery attempts'),
    WorkerSuccessFrequence: Factory.createTaggedFrequencyGauge('worker_success', 'Frequency of delivery success'),

    //
    // Delivery
    //

    DeliveryActive: Factory.createPersistedGauge('delivery_active', 'How many delivety tasks are active', async (ctx) => {
        return await Modules.Messaging.delivery.newQueueUserMultiple.getActive(ctx);
    }),
    DeliveryTotal: Factory.createPersistedGauge('delivery_total', 'How many delivety tasks are created', async (ctx) => {
        return await Modules.Messaging.delivery.newQueueUserMultiple.getTotal(ctx);
    }),
    DeliveryFanOutActive: Factory.createPersistedGauge('delivery_active_fan_out', 'How many delivety fan out tasks are active', async (ctx) => {
        return await Modules.Messaging.delivery.newQeue.getActive(ctx);
    }),
    DeliveryFanOutTotal: Factory.createPersistedGauge('delivery_total_fan_out', 'How many delivety fan out tasks are created', async (ctx) => {
        return await Modules.Messaging.delivery.newQeue.getTotal(ctx);
    }),
    DeliveryAttemptFrequence: Factory.createTaggedFrequencyGauge('delivery_attempts', 'Frequency of delivery attempts'),
    DeliverySuccessFrequence: Factory.createTaggedFrequencyGauge('delivery_success', 'Frequency of delivery success'),

    //
    // EventBus
    //
    EventsSent: Factory.createFrequencyGauge('events_sent', 'Frequency of a sent events to event bus'),
    EventsReceived: Factory.createFrequencyGauge('events_received', 'Frequency of a sent events to event bus'),

    EventsTaggedSent: Factory.createTaggedFrequencyGauge('events_sent_tagged', 'Frequency of a sent events to event bus tagged by prefix'),
    EventsTaggedReceived: Factory.createTaggedFrequencyGauge('events_received_tagged', 'Frequency of a sent events to event bus tagged by prefix'),

    // NodeJS
    EventLoopLag: Factory.createTaggedSummary('nodejs_event_loop_lag', 'Summary of event loop lags', DEFAULT_QUANTILES),

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
    TracingFrequence: Factory.createFrequencyGauge('tracing_span_hz', 'Tracing spans generation frequence'),

    // Basics
    Users: Factory.createPersistedGauge('users_count', 'Total openland users', async (ctx) => {
        return (await Store.User.findAllKeys(ctx)).length;
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
    })
};