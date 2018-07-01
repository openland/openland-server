import { ID } from '../../modules/ID';
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
    Organization: new ID('Organization'),
    OrganizationAccount: new ID('Account'),
    OrganizationListing: new ID('OrganizationListing'),
    Invite: new ID('Invite'),
    InviteInfo: new ID('InviteInfo'),
    State: new ID('State'),
    County: new ID('County'),
    City: new ID('City'),
    User: new ID('User'),
    Profile: new ID('Profile'),
    Deal: new ID('Deal'),
    Block: new ID('Block'),
    SuperAccount: Ids.createId('SuperAccount'),
    SuperCity: new ID('SuperCity'),
    FeatureFlag: new ID('FeatureFlag'),
    Opportunities: new ID('Op'),
    DebugReader: new ID('dr'),
    Folder: new ID('f'),
    FolderItem: new ID('fi'),
    Task: new ID('task'),
};