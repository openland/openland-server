import { createContextNamespace } from '@openland/context';
import { FTransactionReadWrite } from 'foundation-orm/tx/FTransactionReadWrite';
import { FTransactionReadOnly } from 'foundation-orm/tx/FTransactionReadOnly';
import { FConnection } from 'foundation-orm/FConnection';

export const FTransactionContext = createContextNamespace<FTransactionReadWrite | null>('tx-rw', null);
export const FTransactionReadOnlyContext = createContextNamespace<FTransactionReadOnly | null>('tx-ro', null);
export const FConnectionContext = createContextNamespace<FConnection | null>('fdb-connection', null);