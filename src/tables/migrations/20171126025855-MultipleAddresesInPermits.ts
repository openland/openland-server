import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.removeColumn('permits', 'streetNumber');
    await queryInterface.createTable('permit_street_numbers',
        {
            id: {
                type: dataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            permitId: {
                type: dataTypes.INTEGER,
                references: {
                    model: 'permits',
                    key: 'id'
                },
                allowNull: false
            },
            streetnumberId: {
                type: dataTypes.INTEGER,
                references: {
                    model: 'streetnumbers',
                    key: 'id'
                },
                allowNull: false
            },
            createdAt: dataTypes.DATE,
            updatedAt: dataTypes.DATE,
        }
    );
}