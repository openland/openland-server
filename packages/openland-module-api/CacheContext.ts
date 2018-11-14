import { createContextNamespace } from 'openland-utils/Context';

export const CacheContext = createContextNamespace<Map<string, any>>('cache');