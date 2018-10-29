import { SafeContext } from 'openland-utils/SafeContext';
import { SSpan } from './STracer';

export const STraceContext = new SafeContext<{ currentSpan?: SSpan }>();