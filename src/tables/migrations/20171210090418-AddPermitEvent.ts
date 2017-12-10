import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('permit_events',{
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        account: {
            type: sequelize.INTEGER, references: {
                model: 'accounts',
                key: 'id',
            }
            , allowNull: false
        },
        permitId: {
            type: sequelize.INTEGER, references: {
                model: 'permits',
                key: 'id',
            }
            , allowNull: false
        },
        eventType: {
            type: sequelize.ENUM('status_changed', 'field_changed'), allowNull: false
        },
        eventContent: {
            type: sequelize.JSONB, allowNull: false,
        },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE },
    })
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {
    
}