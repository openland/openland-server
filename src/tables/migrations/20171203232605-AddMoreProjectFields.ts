import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('building_projects', 'extrasDeveloper', { type: sequelize.STRING, allowNull: true })
    await queryInterface.addColumn('building_projects', 'extrasGeneralConstructor', { type: sequelize.STRING, allowNull: true })
    await queryInterface.addColumn('building_projects', 'extrasYearEnd', { type: sequelize.STRING, allowNull: true })
    await queryInterface.addColumn('building_projects', 'extrasAddress', { type: sequelize.STRING, allowNull: true })
    await queryInterface.addColumn('building_projects', 'extrasAddressSecondary', { type: sequelize.STRING, allowNull: true })
    await queryInterface.addColumn('building_projects', 'extrasPermit', { type: sequelize.STRING, allowNull: true })
    await queryInterface.addColumn('building_projects', 'extrasComment', { type: sequelize.STRING, allowNull: true })
    await queryInterface.addColumn('building_projects', 'extrasUrl', { type: sequelize.STRING, allowNull: true })
    await queryInterface.addColumn('building_projects', 'picture', { type: sequelize.STRING, allowNull: true })
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {
    
}