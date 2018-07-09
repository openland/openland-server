import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('TRUNCATE TABLE "conversation_user_events";');
    await queryInterface.sequelize.query('TRUNCATE TABLE "conversation_user_states";');
    await queryInterface.sequelize.query('TRUNCATE TABLE "conversation_user_globals";');
    await queryInterface.sequelize.query('TRUNCATE TABLE "conversation_events";');

    await queryInterface.addIndex('conversation_user_states', ['userId', 'conversationId'], { indicesType: 'UNIQUE' });
    await queryInterface.addIndex('conversation_user_globals', ['userId'], { indicesType: 'UNIQUE' });
}