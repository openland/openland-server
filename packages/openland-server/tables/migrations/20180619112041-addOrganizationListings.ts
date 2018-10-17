import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('organization_listings', {
        id: {
            type: sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: sequelize.STRING,
            allowNull: false
        },
        type: {
            type: sequelize.STRING,
            allowNull: false
        },
        extras: {
            type: sequelize.JSON,
            allowNull: false,
            defaultValue: {}
        },
        userId: {
            type: sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
            }
        },
        orgrId: {
            type: sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'organizations',
            }
        },
        createdAt: {
            type: sequelize.DATE
        },
        updatedAt: {
            type: sequelize.DATE
        }
    });
}