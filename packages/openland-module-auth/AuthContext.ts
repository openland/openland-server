import { createContextNamespace } from '@openland/context';

export const AuthContext = createContextNamespace<{ tid?: string, uid?: number }>('auth', {});