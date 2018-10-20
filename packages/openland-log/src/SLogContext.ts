import { SafeContext } from 'openland-utils/SafeContext';

export const SLogContext = new SafeContext<{ path: string[], disabled: boolean }>();