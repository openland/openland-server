import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('ALTER TABLE "developers" DROP CONSTRAINT developers_account_key;');
    await queryInterface.sequelize.query('ALTER TABLE "constructors" DROP CONSTRAINT constructors_account_key;');
}