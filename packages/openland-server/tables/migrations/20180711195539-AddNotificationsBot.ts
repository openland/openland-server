import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {

    let user = await queryInterface.sequelize.query(
        'insert into "users" ("authId", "email", "isBot") VALUES (:authId, :email, :isBot) RETURNING *;',
        {
            replacements: {
                authId: 'bot_notifications',
                email: 'hello@openland.com',
                isBot: true
            }
        }
    );

    let id = user[0][0].id;

    await queryInterface.sequelize.query(
        'insert into "user_profiles" ("userId", "firstName") VALUES (:userId, :firstName) RETURNING *;',
        {
            replacements: {
                userId: id,
                firstName: 'Notifications bot',
            }
        }
    );
}