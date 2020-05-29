import { createContextNamespace } from '@openland/context';

export const RequestContext = createContextNamespace<{ ip?: string, latLong?: { long: number, lat: number } }>('request', {});