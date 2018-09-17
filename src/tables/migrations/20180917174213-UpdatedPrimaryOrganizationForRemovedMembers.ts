import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {

    let users = await queryInterface.sequelize.query('select * from "user_profiles";');

    for (let user of users[0]) {
        if (user.primaryOrganization) {
            let orgs = (await queryInterface.sequelize.query(
                'select "organizations".* from "organization_members" inner join "organizations" on "organization_members"."orgId" = "organizations".id where "organization_members"."userId" = :userId;',
                {
                    replacements: {
                        userId: user.userId
                    }
                }
            ))[0];

            let orgsIds: number[] = orgs.map((o: any) => o.id);

            if (orgsIds.indexOf(user.primaryOrganization) === -1) {
                await queryInterface.sequelize.query(
                    'update "user_profiles" set "primaryOrganization" = :primaryOrganization where "userId" = :userId;',
                    {
                        replacements: {
                            userId: user.userId,
                            primaryOrganization: orgsIds[0]
                        }
                    }
                );
            }
        }
    }
}