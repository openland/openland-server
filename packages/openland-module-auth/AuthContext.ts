import { createContextNamespace } from '@openland/context';

export const AuthContext = createContextNamespace<{ tid?: string, oid?: number, uid?: number }>('auth', {});