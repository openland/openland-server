import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('developers', {
        id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        account: {
            type: sequelize.INTEGER,
            references: {
                model: 'accounts',
                key: 'id',
            },
            unique: true
        },
        title: {type: sequelize.STRING(256), allowNull: false},
        slug: {type: sequelize.STRING(256), allowNull: false},
        url: {type: sequelize.STRING(256), allowNull: true},
        logo: {type: sequelize.STRING(256), allowNull: true},
    });
    await queryInterface.addIndex('developers', ['slug', 'account'], {
        indicesType: 'UNIQUE'
    });

    await queryInterface.createTable('constructors', {
        id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        account: {
            type: sequelize.INTEGER,
            references: {
                model: 'accounts',
                key: 'id',
            },
            unique: true
        },
        title: {type: sequelize.STRING(256), allowNull: false},
        slug: {type: sequelize.STRING(256), allowNull: false},
        url: {type: sequelize.STRING(256), allowNull: true},
        logo: {type: sequelize.STRING(256), allowNull: true},
    });

    await queryInterface.addIndex('constructors', ['slug', 'account'], {
        indicesType: 'UNIQUE'
    });
}