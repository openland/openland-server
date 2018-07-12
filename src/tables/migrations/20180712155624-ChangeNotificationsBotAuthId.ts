import { QueryInterface, DataTypes } from 'sequelize';
import { DB } from '../index';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    let user = await DB.User.findOne({
        where: {
            authId: 'bot_notifications',
            email: 'hello@openland.com',
            isBot: true
        }
    });

    await user!.update({
        authId: 'bot|notifications'
    });
}