import { QueryInterface, DataTypes } from 'sequelize';
import { DB } from '..';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {

    // Create Prefills
    await queryInterface.createTable('user_profile_prefills', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        firstName: { type: sequelize.STRING, allowNull: true },
        lastName: { type: sequelize.STRING, allowNull: true },
        picture: { type: sequelize.STRING, allowNull: true },
        userId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'users' }, unique: true },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE },
    });

    // Copy Prefills
    let allUsers = await queryInterface.sequelize.query('SELECT * from "users";', { type: queryInterface.sequelize.QueryTypes.SELECT });
    for (let item of allUsers) {
        let pr = item as {
            id: number,
            firstName: string,
            lastName: string,
            picture: string,
        };
        if (!await DB.UserProfile.find({ where: { userId: pr.id } })) {
            await DB.UserProfilePrefill.create({
                userId: pr.id,
                firstName: pr.firstName,
                lastName: pr.lastName,
                picture: pr.picture
            });
        }
    }

    // Drop old columns
    await queryInterface.removeColumn('users', 'firstName');
    await queryInterface.removeColumn('users', 'lastName');
    await queryInterface.removeColumn('users', 'picture');
}