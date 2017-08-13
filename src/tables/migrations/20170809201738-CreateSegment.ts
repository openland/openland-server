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

    // Insert default segment
    // var city = await queryInterface.sequelize.query('SELECT id from cities WHERE slug = \'sf\'').any()
    // var id = (<any>city)[0].id as number
    // await queryInterface.bulkInsert('segments', [{
    //     name: 'Housing',
    //     slug: 'housing',
    //     city: id,
    //     activated: true,
    //     createdAt: new Date(),
    //     updatedAt: new Date()
    // }])
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.dropTable('segments')
}