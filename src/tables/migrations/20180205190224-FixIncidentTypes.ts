import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('ALTER TYPE "public"."enum_incidents_category" ADD VALUE IF NOT EXISTS \'pornography\'');
}