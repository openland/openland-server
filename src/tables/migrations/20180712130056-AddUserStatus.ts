import { QueryInterface, DataTypes } from 'sequelize';
import { DB } from '..';
import { Repos } from '../../repositories';

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

    let users = await DB.User.all();
    for (let user of users) {
        let orgs = await Repos.Users.fetchUserAccounts(user.id!!);
        for (let orgid of orgs) {
            let org = await DB.Organization.find({ where: { id: orgid } });
            if (org && org.status === 'ACTIVATED') {
                user.status = 'ACTIVATED';
                break;
            }
        }
        user.save();
    }
}