import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('developers', 'createdAt', sequelize.DATE);
    await queryInterface.addColumn('developers', 'updatedAt', sequelize.DATE);
    await queryInterface.addColumn('constructors', 'createdAt', sequelize.DATE);
    await queryInterface.addColumn('constructors', 'updatedAt', sequelize.DATE);
}