import { QueryInterface, DataTypes } from 'sequelize';
import { DB } from '..';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    let allUsers = await queryInterface.sequelize.query('SELECT * from "users";', { type: queryInterface.sequelize.QueryTypes.SELECT });
    for (let item of allUsers) {
        let pr = item as {
            id: number,
            firstName: string,
            lastName: string,
        };
        if (!await DB.UserProfile.find({ where: { userId: pr.id } })) {
            await DB.UserProfile.create({
                userId: pr.id,
                firstName: pr.firstName,
                lastName: pr.lastName
            });
        }
    }
}