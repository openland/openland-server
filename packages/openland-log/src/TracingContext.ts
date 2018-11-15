import { createContextNamespace } from 'openland-utils/Context';
import { SSpan } from '../SSpan';

export const TracingContext = createContextNamespace<{ span?: SSpan }>('tracing', {});