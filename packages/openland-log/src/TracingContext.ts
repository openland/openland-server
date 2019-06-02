import { createContextNamespace } from '@openland/context';
import { SSpan } from '../SSpan';

export const TracingContext = createContextNamespace<{ span?: SSpan }>('tracing', {});