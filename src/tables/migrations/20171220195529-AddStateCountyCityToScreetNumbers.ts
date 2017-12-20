import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {

    // Drop All old Data
    await queryInterface.dropTable('permit_street_numbers')
    await queryInterface.dropTable('street_numbers')
    await queryInterface.dropTable('streets')

    //
    // Streets
    //

    await queryInterface.createTable('streets', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        cityId: { type: sequelize.INTEGER, references: { model: 'cities', key: 'id' }, allowNull: false },
        name: { type: sequelize.STRING, allowNull: false },
        suffix: {
            type: sequelize.ENUM(['St', 'Av', 'Dr', 'Bl', 'Wy', 'Ln', 'Hy', 'Tr', 'Pl', 'Ct',
                'Pk', 'Al', 'Cr', 'Rd', 'Sq', 'Pz', 'Sw', 'No', 'Rw', 'So', 'Hl', 'Wk']), allowNull: true
        },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE,
    });

    await queryInterface.addIndex('streets', ['cityId', 'name'], {
        indicesType: 'UNIQUE',
        where: {
            'suffix': {
                $eq: null
            }
        }
    });
    await queryInterface.addIndex('streets', ['cityId', 'name', 'suffix'], {
        indicesType: 'UNIQUE',
        where: {
            'suffix': {
                $ne: null
            }
        }
    });

    //
    // Street Numbers
    //

    await queryInterface.createTable('street_numbers', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        streetId: { type: sequelize.INTEGER, references: { model: 'streets', key: 'id' }, allowNull: false },
        number: { type: sequelize.INTEGER, allowNull: false },
        suffix: { type: sequelize.STRING, allowNull: true },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE,
    })
    await queryInterface.addIndex('street_numbers', ['streetId', 'number'], {
        indicesType: 'UNIQUE',
        where: {
            'suffix': {
                $eq: null
            }
        }
    })
    await queryInterface.addIndex('street_numbers', ['streetId', 'number', 'suffix'], {
        indicesType: 'UNIQUE',
        where: {
            'suffix': {
                $ne: null
            }
        }
    })

    //
    // Permits Mapping
    //

    await queryInterface.createTable('permit_street_numbers',
        {
            id: {
                type: sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            permitId: {
                type: sequelize.INTEGER,
                references: {
                    model: 'permits',
                    key: 'id'
                },
                allowNull: false
            },
            streetNumberId: {
                type: sequelize.INTEGER,
                references: {
                    model: 'street_numbers',
                    key: 'id'
                },
                allowNull: false
            },
            createdAt: sequelize.DATE,
            updatedAt: sequelize.DATE,
        }
    )
    await queryInterface.addIndex('permit_street_numbers', ['permitId'])
    await queryInterface.addIndex('permit_street_numbers', ['streetNumberId'])
}

export async function down(queryInterface: QueryInterface, sequelize: DataTypes) {

}