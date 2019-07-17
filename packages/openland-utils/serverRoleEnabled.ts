type ServerRole = 'api' | 'workers' | 'admin' | 'delivery';

export const SUPPORTED_ROLES = [
    'api',
    'workers',
    'admin',
    'delivery'
];

const DEFAULT_SERVER_ROLES = SUPPORTED_ROLES;

const ENABLED_SERVER_ROLES = (process.env.SERVER_ROLES && process.env.SERVER_ROLES.length > 0) ? process.env.SERVER_ROLES.split(',') : DEFAULT_SERVER_ROLES;

export function serverRoleEnabled(role: ServerRole): boolean {
    return ENABLED_SERVER_ROLES.indexOf(role) > -1;
}