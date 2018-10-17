import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('deals', 'price', { type: sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('deals', 'area', { type: sequelize.INTEGER, allowNull: true });
    await queryInterface.addColumn('deals', 'company', { type: sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('deals', 'attorney', { type: sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('deals', 'referee', { type: sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('deals', 'lotShape', { type: sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('deals', 'lotSize', { type: sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('deals', 'taxBill', { type: sequelize.INTEGER, allowNull: true });
}