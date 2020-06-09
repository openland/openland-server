import { Store } from 'openland-module-db/FDB';
import { MetricFactory } from './MetricFactory';

export const Factory = new MetricFactory();

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
    SpaceXOperationTime: Factory.createGauge('spacex_req_duration', 'Duration of SpaceX operation'),
    SpaceXSubscriptions: Factory.createMachineGauge('spacex_sub', 'Number of active SpaceX subscriptions'),
    SpaceXSubscriptionEvents: Factory.createFrequencyGauge('spacex_sub_hz', 'Frequency of SpaceX subscription events'),

    // GQL: Obsolete
    GQLRequestTime: Factory.createGauge('gql_request_time', 'Time of GraphQL request resolving', 'median'),
    GQLRequests: Factory.createMachineGauge('gql_requests', 'Number of parallel graphql requests'),

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