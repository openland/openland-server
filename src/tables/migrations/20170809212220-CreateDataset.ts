import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.createTable('datasets', {
        id: {
            type: dataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        name: {
            type: dataTypes.STRING,
            allowNull: false
        },
        description: {
            type: dataTypes.STRING,
            allowNull: false
        },
        link: {
            type: dataTypes.STRING,
            allowNull: false
        },
        segment: {
            type: dataTypes.INTEGER,
            references: {
                model: 'segments',
                key: 'id',
            },
            allowNull: false
        },
        kind: {
            type: dataTypes.ENUM(['dataset', 'report']),
            allowNull: false
        },
        activated: {
            type: dataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        createdAt: { type: dataTypes.DATE, allowNull: false },
        updatedAt: { type: dataTypes.DATE, allowNull: false }
    })

    // var segment = await queryInterface.sequelize.query('SELECT id from segments WHERE slug = \'housing\'').any()
    // var segmentId = (<any>segment)[0].id as number

    // await queryInterface.bulkInsert('datasets', [{
    //     name: 'Housing Element 2014',
    //     description: 'Complete 200+ pages report that have all information about housing research in SF government',
    //     link: 'http://208.121.200.84/ftp/files/plans-and-programs/planning-for-the-city/housing-element/2014HousingElement-AllParts_ADOPTED_web.pdf',
    //     segment: segmentId,
    //     kind: 'report',
    //     activated: true,
    //     createdAt: new Date(),
    //     updatedAt: new Date()
    // }])
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.dropTable('datasets')
}