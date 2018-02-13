import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('ALTER TABLE "lots" ALTER COLUMN "blockId" DROP NOT NULL');
}