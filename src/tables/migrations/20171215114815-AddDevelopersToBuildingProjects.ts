import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('building_project_developers', {
        id: {
            type: sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        developerId: {
            type: sequelize.INTEGER,
            references: {
                model: 'developers',
                key: 'id'
            },
            allowNull: false
        },
        buildingProjectId: {
            type: sequelize.INTEGER,
            references: {
                model: 'building_projects',
                key: 'id'
            },
            allowNull: false
        },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE,
    });
    await queryInterface.addIndex('building_project_developers', ['developerId', 'buildingProjectId'], {
        indicesType: 'UNIQUE'
    });
}