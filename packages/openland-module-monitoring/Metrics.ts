import { MetricFactory } from './MetricFactory';

export const Factory = new MetricFactory();

export const Metrics = {
    Connections: Factory.createMachineGauge('connections', 'Active WebSocket connections'),

    UsersOnline: Factory.createGauge('users_online', 'Total online users'),
    UsersActive: Factory.createGauge('users_active', 'Total active users'),
};