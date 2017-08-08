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
    queryInterface.bulkInsert('users', [{
        authId: "facebook|10213268338843701",
        firstName: "Stepan",
        lastName: "Korshakov",
        email: "korshakov.stepan@gmail.com",
        picture: "https://scontent.xx.fbcdn.net/v/t1.0-1/p50x50/12799449_10208337398773281_8543476314381451147_n.jpg?oh=f5e1fb63405ecf5dc1f88950fdcb4257&oe=5A2F17E5"
    }])
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.dropTable('users')
}