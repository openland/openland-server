import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {

    //
    // States
    //

    await queryInterface.createTable('states', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        code: { type: sequelize.STRING, allowNull: false, unique: true },
        name: { type: sequelize.STRING, allowNull: false },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE,
    });

    //
    // Counties
    //

    await queryInterface.createTable('counties', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        stateId: { type: sequelize.INTEGER, references: { model: 'states', key: 'id' }, allowNull: false },
        code: { type: sequelize.STRING, allowNull: false },
        name: { type: sequelize.STRING, allowNull: false },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE,
    });
    await queryInterface.addIndex('counties', ['stateId', 'code'], { indicesType: 'UNIQUE' })

    //
    // Cities
    //

    await queryInterface.createTable('cities', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        countyId: { type: sequelize.INTEGER, references: { model: 'counties', key: 'id' }, allowNull: false },
        name: { type: sequelize.STRING, allowNull: false },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE,
    });
    await queryInterface.addIndex('cities', ['countyId', 'name'], { indicesType: 'UNIQUE' });
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {

}