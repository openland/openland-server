import { Store } from 'openland-module-db/FDB';
import { MetricFactory } from './MetricFactory';

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
    SpaceXReadsPerQuery: Factory.createSummary('spacex_reads_query', 'Summary of read operations per query', DEFAULT_QUANTILES),
    SpaceXReadsPerSubscription: Factory.createSummary('spacex_reads_subscription', 'Summary of read operations per subscription', DEFAULT_QUANTILES),
    SpaceXReadsPerSubscriptionResolve: Factory.createSummary('spacex_reads_subscription_resolve', 'Summary of read operations per subscription resolve', DEFAULT_QUANTILES),
    SpaceXReadsPerMutation: Factory.createSummary('spacex_reads_mutation', 'Summary of read operations per mutation', DEFAULT_QUANTILES),
    SpaceXWrites: Factory.createSummary('spacex_writes', 'Summary of write operations', DEFAULT_QUANTILES),
    SpaceXWritesPerQuery: Factory.createSummary('spacex_writes_query', 'Summary of read operations per query', DEFAULT_QUANTILES),
    SpaceXWritesPerSubscription: Factory.createSummary('spacex_writes_subscription', 'Summary of read operations per subscription', DEFAULT_QUANTILES),
    SpaceXWritesPerSubscriptionResolve: Factory.createSummary('spacex_writes_subscription_resolve', 'Summary of read operations per subscription resolve', DEFAULT_QUANTILES),
    SpaceXWritesPerMutation: Factory.createSummary('spacex_writes_mutation', 'Summary of read operations per mutation', DEFAULT_QUANTILES),

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
    })
};