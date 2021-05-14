type ServerRole = 'api' | 'workers' | 'admin' | 'delivery' | 'calls' | 'events' | 'executor' | 'executor-calls'| 'events-chat' | 'events-calls';

export const SUPPORTED_ROLES = [
    'api',
    'workers',
    'admin',
    'delivery',
    'calls',
    'events',
    'executor',
    'executor-calls',
    'events-chat',
    'events-calls'
];

const DEFAULT_SERVER_ROLES = [
    'api',
    'workers',
    'admin',
    'delivery',
    'calls',
    'events',
    'executor',
    'executor-calls',
    'events-chat',
    'events-calls'
];

const ENABLED_SERVER_ROLES = (process.env.SERVER_ROLES && process.env.SERVER_ROLES.length > 0) ? process.env.SERVER_ROLES.split(',') : DEFAULT_SERVER_ROLES;

export function serverRoleEnabled(role: ServerRole): boolean {
    return ENABLED_SERVER_ROLES.indexOf(role) > -1;
}

export function getServerRoles() {
    return ENABLED_SERVER_ROLES;
}