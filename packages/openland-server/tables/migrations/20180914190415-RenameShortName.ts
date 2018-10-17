import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.renameTable('short_name', 'short_names');
    await queryInterface.addColumn('short_names', 'createdAt', { type: sequelize.DATE });
    await queryInterface.addColumn('short_names', 'updatedAt', { type: sequelize.DATE });
}