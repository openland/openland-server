import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('user_profiles', 'primaryOrganization', {
        type: sequelize.INTEGER,
        allowNull: true,
        references: {
            model: 'organizations'
        }
    });

    let users = await queryInterface.sequelize.query('select * from "user_profiles";');

    for (let user of users[0]) {
        if (user.extras && user.extras.primaryOrganization) {
            await queryInterface.sequelize.query(
                'update "user_profiles" set "primaryOrganization" = :primaryOrganization where userId=:userId;',
                {
                    replacements: {
                        userId: user.id,
                        primaryOrganization: user.extras.primaryOrganization
                    }
                }
            );
        } else {
            let orgs = await queryInterface.sequelize.query(
                'select "organizations".* from "organization_members" inner join "organizations" on "organization_members"."orgId" = "organizations".id where "organization_members"."userId" = :userId;',
                {
                    replacements: {
                        userId: user.userId
                    }
                }
            );

            let org = orgs[0][0];

            if (org) {
                await queryInterface.sequelize.query(
                    'update "user_profiles" set "primaryOrganization" = :primaryOrganization where userId=:userId;',
                    {
                        replacements: {
                            userId: user.id,
                            primaryOrganization: org.id
                        }
                    }
                );
            }
        }
    }
}