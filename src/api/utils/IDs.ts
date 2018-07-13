import { SecIDFactory } from '../../modules/SecID';

let salt = 'DEBUG_SALT. IF IN PRODUCTION - YOU WILL BE FIRED';
if (!process.env.AUTHENTICATION_SALT || process.env.AUTHENTICATION_SALT.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
        throw Error('AUTHENTICATION_SALT is not set');
    }
} else {
    salt = process.env.AUTHENTICATION_SALT!!.trim();
}

export const IdsFactory = new SecIDFactory(salt, 'hashids');

export const IDs = {
    Organization: IdsFactory.createId('Organization'),
    OrganizationAccount: IdsFactory.createId('OrganizationAccount'),
    OrganizationListing: IdsFactory.createId('OrganizationListing'),
    Invite: IdsFactory.createId('Invite'),
    InviteInfo: IdsFactory.createId('InviteInfo'),
    State: IdsFactory.createId('State'),
    County: IdsFactory.createId('County'),
    City: IdsFactory.createId('City'),
    User: IdsFactory.createId('User'),
    Profile: IdsFactory.createId('Profile'),
    Deal: IdsFactory.createId('Deal'),
    Block: IdsFactory.createId('Block'),
    SuperAccount: IdsFactory.createId('SuperAccount'),
    SuperCity: IdsFactory.createId('SuperCity'),
    FeatureFlag: IdsFactory.createId('FeatureFlag'),
    Opportunities: IdsFactory.createId('Opportunities'),
    DebugReader: IdsFactory.createId('DebugReader'),
    Folder: IdsFactory.createId('Folder'),
    FolderItem: IdsFactory.createId('FolderItem'),
    Task: IdsFactory.createId('Task'),
    Conversation: IdsFactory.createId('Conversation'),
    ConversationMessage: IdsFactory.createId('ConversationMessage'),
    NotificationCounter: IdsFactory.createId('NotificationCounter'),
    UserEvent: IdsFactory.createId('UserEvent'),
    Settings: IdsFactory.createId('Settings')
};