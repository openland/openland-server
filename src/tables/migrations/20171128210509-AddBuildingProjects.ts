import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('building_projects', {
        id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        account: {
            type: sequelize.INTEGER, references: {
                model: 'accounts',
                key: 'id',
            },
            allowNull: false
        },
        projectId: {type: sequelize.STRING, allowNull: false},
        name: {type: sequelize.STRING, allowNull: false},
        description: {type: sequelize.STRING, allowNull: true},
        status: {
            type: sequelize.ENUM('starting', 'in_progress', 'completed'),
            allowNull: false,
            defaultValue: 'starting'
        },
        verified: {type: sequelize.BOOLEAN, allowNull: false, defaultValue: false},

        projectStartedAt: {type: sequelize.DATEONLY, allowNull: true},
        projectCompletedAt: {type: sequelize.DATEONLY, allowNull: true},
        projectExpectedCompletedAt: {type: sequelize.DATEONLY, allowNull: true},

        existingUnits: {type: sequelize.INTEGER, allowNull: true},
        proposedUnits: {type: sequelize.INTEGER, allowNull: true},
        existingAffordableUnits: {type: sequelize.INTEGER, allowNull: true},
        proposedAffordableUnits: {type: sequelize.INTEGER, allowNull: true},
    });
    await queryInterface.addIndex('building_projects', ['projectId', 'account'], {
        indicesType: 'UNIQUE'
    });

    await queryInterface.createTable('permit_building_projects', {
        id: {
            type: sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        permitId: {
            type: sequelize.INTEGER,
            references: {
                model: 'permits',
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
    await queryInterface.addIndex('permit_building_projects', ['permitId', 'buildingProjectId'], {
        indicesType: 'UNIQUE'
    });
}