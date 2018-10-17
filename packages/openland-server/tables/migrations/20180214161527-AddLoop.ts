import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('ALTER TYPE "public"."enum_streets_suffix" ADD VALUE IF NOT EXISTS \'Lp\'');
}