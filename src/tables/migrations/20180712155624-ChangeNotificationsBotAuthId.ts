import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {

    await queryInterface.sequelize.query(
        'update "users" set "authId"=:newAuthId where "authId"=:oldAuthId AND "email"=:email AND "isBot"=:isBot;',
        {
            replacements: {
                isBot: true,
                email: 'hello@openland.com',
                oldAuthId: 'bot_notifications',

                newAuthId: 'bot|notifications'
            }
        }
    );
}