import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('ALTER TYPE "public"."enum_incidents_category" ADD VALUE IF NOT EXISTS \'sex_offenses_forcible\'');
    await queryInterface.sequelize.query('ALTER TYPE "public"."enum_incidents_category" ADD VALUE IF NOT EXISTS \'counterfeiting\'');
    // await queryInterface.sequelize.query('ALTER TYPE "public"."enum_incidents_category" DELETE VALUE IF EXISTS \'sex_offenses\'');
}