import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.createTable('permits', {
        id: { type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        account: {
            type: dataTypes.INTEGER, references: {
                model: 'accounts',
                key: 'id',
            }
        },
        address: { type: dataTypes.STRING, allowNull: true },
        permitStatus: { type: dataTypes.ENUM('filled', 'issued', 'completed', 'expired'), allowNull: true },
        permitCreated: { type: dataTypes.DATEONLY, allowNull: true },
        permitIssued: { type: dataTypes.DATEONLY, allowNull: true },
        permitCompleted: { type: dataTypes.DATEONLY, allowNull: true },
        permitExpired: { type: dataTypes.DATEONLY, allowNull: true },
        createdAt: { type: dataTypes.DATE },
        updatedAt: { type: dataTypes.DATE }
    })
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    
}