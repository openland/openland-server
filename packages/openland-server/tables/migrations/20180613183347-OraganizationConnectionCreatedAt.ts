import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    queryInterface.addColumn('organization_connects', 'createdAt', sequelize.DATE);
    queryInterface.addColumn('organization_connects', 'updatedAt', sequelize.DATE);
}