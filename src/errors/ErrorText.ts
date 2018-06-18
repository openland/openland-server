export const ErrorText = {
    unableToFindOpportunity: 'Opportunity not found',
    unableToFindUser: 'User not found',
    unableToFindInvite: 'Unable to find invite',
    unableToFindOrganization: 'Organization not found',
    unableToFindOrganizationNamed: (name: string) =>  name + '- Organization not found',
    unableToFindDeal: 'Unable to find deal',
    unableToFindAccount: (domain: string) => 'Unable to find account ' + domain,
    unableToFindCity: (state: string, county: string, city: string) => 'City is not found for ' + state + ', ' + county + ', ' + city,
    unableToFindCityTag: (tag: string) => 'City is not found for tag ' + tag,
    unableToFindArea: (domain: string) => 'Unknown area ' + domain,
    unableToFindFolder: 'Folder not found',
    unableToFindParcel: 'Unable to find parcel',

    titleRequired: 'Title is required',
    nameEmpty: 'Name can\'t be empty',
    firstNameEmpty: 'First Name can\'t be empty',
    permissionDenied: 'Access denied',
    permissionOnlyOwner: 'Only organization owners can edit this profile',
    permissionAuthenticatoinRequired: 'Authentication is required',
    unableToRemoveLastSuperAdmin: 'You can\'t remove the last Super Admin from the system',
    unableToRemoveLastMember: 'You can\'t remove the last member from the organization'
};