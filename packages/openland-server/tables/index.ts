import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export { User } from './User';
export { ReaderState } from './ReaderState';

import { UserTable } from './User';
import { ReaderStateTable } from './ReaderState';
import { OrganizationTable } from './Organization';
import { OrganizationMemberTable } from './OrganizationMember';
import { ConversationTable } from './Conversation';
import { retry } from '../utils/timer';

const SILENT_TX_ACTUALLY_SILENT = process.env.NODE_ENV !== 'production';
export const DB_SILENT = !SILENT_TX_ACTUALLY_SILENT;

export const DB = {
    User: UserTable,
    ReaderState: ReaderStateTable,
    Organization: OrganizationTable,
    OrganizationMember: OrganizationMemberTable,

    Conversation: ConversationTable,

    tx: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>, existingTx?: sequelize.Transaction): Promise<A> {
        if (existingTx) {
            return handler(existingTx);
        }
        return await connection.transaction({ isolationLevel: 'SERIALIZABLE' }, async (tx2: sequelize.Transaction) => await handler(tx2));
    },
    txLight: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        return await connection.transaction(async (tx2: sequelize.Transaction) => await handler(tx2));
    },
    txStable: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>, existingTx?: sequelize.Transaction): Promise<A> {
        if (existingTx) {
            return handler(existingTx);
        }
        return retry(async () => await connection.transaction(async (tx2: sequelize.Transaction) => await handler(tx2)));
    },
    txStableSilent: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        if (SILENT_TX_ACTUALLY_SILENT) {
            return retry(async () => await connection.transaction({
                logging: () => {
                    //
                }
            }, (tx2: sequelize.Transaction) => handler(tx2)));
        } else {
            return retry(async () => await connection.transaction({}, async (tx2: sequelize.Transaction) => await handler(tx2)));
        }
    },
    txSilent: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        if (SILENT_TX_ACTUALLY_SILENT) {
            return await connection.transaction({
                isolationLevel: 'SERIALIZABLE', logging: () => {
                    //
                }
            }, async (tx2: sequelize.Transaction) => await handler(tx2));
        } else {
            return await connection.transaction({
                isolationLevel: 'SERIALIZABLE'
            }, async (tx2: sequelize.Transaction) => await handler(tx2));
        }
    },
    connection: connection
};