import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.createTable('cities', {
        id: { type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: dataTypes.STRING },
        slug: { type: dataTypes.STRING, unique: true },
        activated: { type: dataTypes.BOOLEAN, defaultValue: false },
        createdAt: { type: dataTypes.DATE },
        updatedAt: { type: dataTypes.DATE }
    })
    // await queryInterface.bulkInsert('cities', [{
    //     name: "San Francisco",
    //     slug: "sf",
    //     activated: true,
    //     createdAt: new Date(),
    //     updatedAt: new Date()
    // }, {
    //     name: "New York",
    //     slug: "nyc",
    //     activated: false,
    //     createdAt: new Date(),
    //     updatedAt: new Date()
    // }])
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.dropTable('cities')
}