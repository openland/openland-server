import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {

    await queryInterface.addColumn('users', 'status', {
        type: sequelize.ENUM(
            'PENDING',
            'ACTIVATED',
            'SUSPENDED'
        ),
        defaultValue: 'PENDING',
        allowNull: false
    });

    let users = await queryInterface.sequelize.query('select * from "users";');

    for (let user of users[0]) {
        let orgs = await queryInterface.sequelize.query(
            'select "organizations".* from "organization_members" inner join "organizations" on "organization_members"."orgId" = "organizations".id where "organization_members"."userId" = :userId;',
            {
                replacements: {
                    userId: user.id
                }
            }
        );

        for (let org of orgs[0]) {
            if (org.status === 'ACTIVATED') {
                await queryInterface.sequelize.query(
                    'update "users" set "status" = \'ACTIVATED\' where id=:userId;',
                    {
                        replacements: {
                            userId: user.id
                        }
                    }
                );
                break;
            }
        }
    }
}