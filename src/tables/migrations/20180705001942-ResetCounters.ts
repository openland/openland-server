import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('TRUNCATE TABLE "conversation_user_states";');
    await queryInterface.sequelize.query('TRUNCATE TABLE "conversation_user_globals";');
}