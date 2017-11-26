import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.createTable('segments', {
        id: { type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: dataTypes.STRING, allowNull: false },
        slug: { type: dataTypes.STRING, unique: true, allowNull: false },
        city: {
            type: dataTypes.INTEGER, references: {
                model: 'cities',
                key: 'id',
            }, allowNull: false
        },
        activated: { type: dataTypes.BOOLEAN, defaultValue: false, allowNull: false },
        createdAt: { type: dataTypes.DATE, allowNull: false },
        updatedAt: { type: dataTypes.DATE, allowNull: false }
    })
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    
}