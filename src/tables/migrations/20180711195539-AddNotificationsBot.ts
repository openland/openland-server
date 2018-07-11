import { QueryInterface, DataTypes } from 'sequelize';
import { DB } from '../index';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    let user = await DB.User.create({
        authId: 'bot_notifications',
        email: 'hello@openland.com',
        isBot: true
    });

    await DB.UserProfile.create({
        userId: user.id,
        firstName: 'Notifications bot'
    });
}