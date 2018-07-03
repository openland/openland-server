import { SecIDFactory } from '../../modules/SecID';

let salt = 'DEBUG_SALT. IF IN PRODUCTION - YOU WILL BE FIRED';
if (!process.env.AUTHENTICATION_SALT || process.env.AUTHENTICATION_SALT.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
        throw Error('AUTHENTICATION_SALT is not set');
    }
} else {
    salt = process.env.AUTHENTICATION_SALT!!.trim();
}

const Ids = new SecIDFactory(salt, 'hashids');

export const IDs = {
    Organization: Ids.createId('Organization'),
    OrganizationAccount: Ids.createId('OrganizationAccount'),
    OrganizationListing: Ids.createId('OrganizationListing'),
    Invite: Ids.createId('Invite'),
    InviteInfo: Ids.createId('InviteInfo'),
    State: Ids.createId('State'),
    County: Ids.createId('County'),
    City: Ids.createId('City'),
    User: Ids.createId('User'),
    Profile: Ids.createId('Profile'),
    Deal: Ids.createId('Deal'),
    Block: Ids.createId('Block'),
    SuperAccount: Ids.createId('SuperAccount'),
    SuperCity: Ids.createId('SuperCity'),
    FeatureFlag: Ids.createId('FeatureFlag'),
    Opportunities: Ids.createId('Opportunities'),
    DebugReader: Ids.createId('DebugReader'),
    Folder: Ids.createId('Folder'),
    FolderItem: Ids.createId('FolderItem'),
    Task: Ids.createId('Task'),
    Conversation: Ids.createId('Conversation'),
    ConversationMessage: Ids.createId('ConversationMessage'),
};