import { DB } from '../../tables';

export async function createOrganizations() {
    let testOrg = await DB.Organization.create({
        name: 'Test Organization',
        status: 'ACTIVATED'
    });

    await DB.OrganizationMember.create({
        orgId: testOrg.id,
        userId: 1,
        isOwner: true
    });

    await DB.OrganizationMember.create({
        orgId: testOrg.id,
        userId: 2,
        isOwner: false
    });

    await DB.Organization.create({
        name: 'Suspended Organization',
        status: 'SUSPENDED'
    });

    await DB.Organization.create({
        name: 'Pending Organization',
        status: 'PENDING'
    });
}