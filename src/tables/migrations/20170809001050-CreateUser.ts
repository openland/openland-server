import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.createTable('users', {
        id: { type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        authId: { type: dataTypes.STRING, unique: true },
        firstName: { type: dataTypes.STRING, allowNull: false },
        lastName: { type: dataTypes.STRING, allowNull: false },
        email: { type: dataTypes.STRING, allowNull: false },
        picture: { type: dataTypes.STRING, allowNull: false },
        createdAt: { type: dataTypes.DATE },
        updatedAt: { type: dataTypes.DATE }
    })
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    
}