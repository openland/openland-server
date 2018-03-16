import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    
    // Status
    await queryInterface.addColumn('deals', 'status', { type: sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('deals', 'statusDescription', { type: sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('deals', 'statusDate', { type: sequelize.DATE, allowNull: true });

    // Location Information
    await queryInterface.addColumn('deals', 'location', { type: sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('deals', 'address', { type: sequelize.STRING, allowNull: true });
}