export const ErrorText = {
    unableToFindOpportunity: 'Unable to find opportunity',
    unableToFindUser: 'Unable to find user',
    unableToFindInvite: 'Unable to find invite',
    unableToFindOrganization: 'Organization not found',
    unableToFindOrganizationNamed: (name: string) => 'Unable to find Organization ' + name,
    unableToFindDeal: 'Unable to find deal',
    unableToFindAccount: (domain: string) => 'Unable to find account ' + domain,
    unableToFindCity: (state: string, county: string, city: string) => 'City is not found for ' + state + ', ' + county + ', ' + city,
    unableToFindCityTag: (tag: string) => 'City is not found for tag ' + tag,
    unableToFindArea: (domain: string) => 'Unknown area ' + domain,
    unableToFindFolder: 'Unable to find folder',
    unableToFindParcel: 'Unable to find parcel',

    titleRequired: 'Title is required',
    nameEmpty: 'Name can\'t be empty',
    firstNameEmpty: 'First name can\'t be empty',

    permissionDenied: 'Access Denied',
    permissionOnlyOwner: 'Only owner can edit orgnization',
    permissionAuthenticatoinRequired: 'Authentication is required',

    unableToRemoveLastSuperAdmin: 'You can\'t remove last Super Admin from the system',
    unableToRemoveLastMember: 'You can\'t remove last member from the organization'
};