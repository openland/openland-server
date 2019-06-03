import { createContextNamespace } from '@openland/context';

export const CacheContext = createContextNamespace<Map<string, any> | undefined>('cache', undefined);