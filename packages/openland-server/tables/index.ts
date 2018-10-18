import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export { User } from './User';
export { Account } from './Account';
export { AccountMember } from './Account';
export { ReaderState } from './ReaderState';
export { Lock } from './Lock';

import { UserTable } from './User';
import { AccountTable } from './Account';
import { AccountMemberTable } from './Account';
import { ReaderStateTable } from './ReaderState';
import { LockTable } from './Lock';
import { SuperAdminTable } from './SuperAdmin';
import { UserTokenTable } from './UserToken';
import { OrganizationTable } from './Organization';
import { FeatureFlagTable } from './FeatureFlag';
import { TaskTable } from './Task';
import { UserProfileTable } from './UserProfile';
import { UserProfilePrefillTable } from './UserProfilePrefill';
import { OrganizationMemberTable } from './OrganizationMember';
import { OrganizationInviteTable } from './OrganizationInvite';
import { OrganizationConnectTable } from './OrganizationConnect';
import { OrganizationListingTable } from './OrganizationListing';
import { ConversationTable } from './Conversation';
import { ConversationMessageTable } from './ConversationMessage';
import { ConversationEventTable } from './ConversationEvent';
import { ConversationBlockedTable } from './ConversationBlocked';
import { ConversationUserStateTable } from './ConversatonUserState';
import { ConversationsUserGlobalTable } from './ConversationsUserGlobal';
import { ConversationUserEventsTable } from './ConversationUserEvents';
import { retry } from '../utils/timer';
import { ConversationGroupMembersTable } from './ConversationGroupMembers';
import { UserPresenceTable } from './UserPresence';
import { UserPushRegistrationTable } from './UserPushRegistration';
import { UserSettingsTable } from './UserSettings';
import { HitsTable } from './Hit';
import { ConversationChannelMembersTable } from './ConversationChannelMembers';
import { ChannelInviteTable } from './ChannelInvite';
import { ConversationsUserGlobalNotificationsTable } from './ConversationsUserGlobalNotifications';
import { ShortNameTable } from './ShortName';
import { PhoneTable } from './Phone';
import { AuthSessionTable } from './AuthSession';
import { AuthAuditTable } from './AuthAudit';
import { PrivateCallTable } from './PrivateCall';

const SILENT_TX_ACTUALLY_SILENT = true;
export const DB_SILENT = !SILENT_TX_ACTUALLY_SILENT;

export const DB = {
    User: UserTable,
    Account: AccountTable,
    AccountMember: AccountMemberTable,
    ReaderState: ReaderStateTable,
    // Lock: LockTable,
    SuperAdmin: SuperAdminTable,
    UserToken: UserTokenTable,
    Organization: OrganizationTable,
    OrganizationConnect: OrganizationConnectTable,
    FeatureFlag: FeatureFlagTable,
    Task: TaskTable,
    UserProfile: UserProfileTable,
    UserProfilePrefill: UserProfilePrefillTable,
    OrganizationMember: OrganizationMemberTable,
    OrganizationInvite: OrganizationInviteTable,
    OrganizationListing: OrganizationListingTable,
    Conversation: ConversationTable,
    ConversationMessage: ConversationMessageTable,
    ConversationEvent: ConversationEventTable,
    ConversationUserState: ConversationUserStateTable,
    ConversationsUserGlobal: ConversationsUserGlobalTable,
    ConversationUserEvents: ConversationUserEventsTable,
    ConversationGroupMembers: ConversationGroupMembersTable,
    ConversationBlocked: ConversationBlockedTable,
    UserPresence: UserPresenceTable,
    UserPushRegistration: UserPushRegistrationTable,
    UserSettings: UserSettingsTable,
    Hit: HitsTable,
    ConversationChannelMembers: ConversationChannelMembersTable,
    ChannelInvite: ChannelInviteTable,
    ConversationsUserGlobalNotifications: ConversationsUserGlobalNotificationsTable,
    ShortName: ShortNameTable,
    Phone: PhoneTable,
    AuthSession: AuthSessionTable,
    AuthAudit: AuthAuditTable,
    PrivateCall: PrivateCallTable,

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