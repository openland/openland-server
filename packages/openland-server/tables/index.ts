import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export { User } from './User';
export { ReaderState } from './ReaderState';

import { UserTable } from './User';
import { ReaderStateTable } from './ReaderState';
import { SuperAdminTable } from './SuperAdmin';
import { OrganizationTable } from './Organization';
import { OrganizationMemberTable } from './OrganizationMember';
import { OrganizationInviteTable } from './OrganizationInvite';
import { OrganizationConnectTable } from './OrganizationConnect';
import { ConversationTable } from './Conversation';
import { ConversationMessageTable } from './ConversationMessage';
import { ConversationEventTable } from './ConversationEvent';
import { ConversationBlockedTable } from './ConversationBlocked';
import { ConversationUserStateTable } from './ConversatonUserState';
import { ConversationsUserGlobalTable } from './ConversationsUserGlobal';
import { ConversationUserEventsTable } from './ConversationUserEvents';
import { retry } from '../utils/timer';
import { ConversationGroupMembersTable } from './ConversationGroupMembers';
import { UserSettingsTable } from './UserSettings';
import { ConversationChannelMembersTable } from './ConversationChannelMembers';
import { ChannelInviteTable } from './ChannelInvite';
import { ConversationsUserGlobalNotificationsTable } from './ConversationsUserGlobalNotifications';
import { ShortNameTable } from './ShortName';
import { PhoneTable } from './Phone';
import { AuthSessionTable } from './AuthSession';

const SILENT_TX_ACTUALLY_SILENT = true;
export const DB_SILENT = !SILENT_TX_ACTUALLY_SILENT;

export const DB = {
    User: UserTable,
    ReaderState: ReaderStateTable,
    SuperAdmin: SuperAdminTable,
    Organization: OrganizationTable,
    OrganizationConnect: OrganizationConnectTable,
    OrganizationMember: OrganizationMemberTable,
    OrganizationInvite: OrganizationInviteTable,
    Conversation: ConversationTable,
    ConversationMessage: ConversationMessageTable,
    ConversationEvent: ConversationEventTable,
    ConversationUserState: ConversationUserStateTable,
    ConversationsUserGlobal: ConversationsUserGlobalTable,
    ConversationUserEvents: ConversationUserEventsTable,
    ConversationGroupMembers: ConversationGroupMembersTable,
    ConversationBlocked: ConversationBlockedTable,
    UserSettings: UserSettingsTable,
    ConversationChannelMembers: ConversationChannelMembersTable,
    ChannelInvite: ChannelInviteTable,
    ConversationsUserGlobalNotifications: ConversationsUserGlobalNotificationsTable,
    ShortName: ShortNameTable,
    Phone: PhoneTable,
    AuthSession: AuthSessionTable,

    tx: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>, existingTx?: sequelize.Transaction): Promise<A> {
        if (existingTx) {
            return handler(existingTx);
        }
        return await connection.transaction({ isolationLevel: 'SERIALIZABLE' }, (tx2: sequelize.Transaction) => handler(tx2));
    },
    txLight: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        return await connection.transaction((tx2: sequelize.Transaction) => handler(tx2));
    },
    txStable: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>, existingTx?: sequelize.Transaction): Promise<A> {
        if (existingTx) {
            return handler(existingTx);
        }
        return retry(async () => await connection.transaction((tx2: sequelize.Transaction) => handler(tx2)));
    },
    txStableSilent: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        if (SILENT_TX_ACTUALLY_SILENT) {
            return retry(async () => await connection.transaction({
                logging: () => {
                    //
                }
            }, (tx2: sequelize.Transaction) => handler(tx2)));
        } else {
            return retry(async () => await connection.transaction({}, (tx2: sequelize.Transaction) => handler(tx2)));
        }
    },
    txSilent: async function tx<A>(handler: (tx: sequelize.Transaction) => PromiseLike<A>): Promise<A> {
        if (SILENT_TX_ACTUALLY_SILENT) {
            return await connection.transaction({
                isolationLevel: 'SERIALIZABLE', logging: () => {
                    //
                }
            }, (tx2: sequelize.Transaction) => handler(tx2));
        } else {
            return await connection.transaction({
                isolationLevel: 'SERIALIZABLE'
            }, (tx2: sequelize.Transaction) => handler(tx2));
        }
    },
    connection: connection
};