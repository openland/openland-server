import { createContextNamespace } from 'openland-utils/Context';

export const AuthContext = createContextNamespace<{ tid?: string, oid?: number, uid?: number }>('auth', {});