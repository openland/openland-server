import { createContextNamespace } from '@openland/context';

export const RequestContext = createContextNamespace<{ ip?: string }>('request', {});