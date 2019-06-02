import { createContextNamespace } from '@openland/context';

// import { SafeContext } from 'openland-utils/SafeContext';

// export const SLogContext = new SafeContext<{ path: string[], disabled: boolean }>();

export const SLogContext = createContextNamespace<{ path: string[], disabled: boolean }>('log', { path: [], disabled: false });