import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('incidents', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        account: {
            type: sequelize.INTEGER, references: {
                model: 'accounts',
                key: 'id',
            },
            allowNull: false
        },
        incidentNumber: { type: sequelize.STRING, allowNull: true },
        importId: { type: sequelize.STRING, allowNull: true },

        category: {
            type: sequelize.ENUM(
                'robbery',
                'assault',
                'secondary_codes',
                'non_criminal',
                'vandalism',
                'burglary',
                'larceny',
                'drug',
                'warrants',
                'vehicle_theft',
                'other_offenses',
                'weapon_laws',
                'arson',
                'missing_person',
                'driving_under_the_influence',
                'suspicious_occ',
                'recovered_vehicle',
                'drunkenness',
                'trespass',
                'fraud',
                'disorderly_conduct',
                'sex_offenses',
                'forcible',
                'counterfreiting',
                'kidnapping',
                'embezzlement',
                'stolen_property',
                'liquor_laws',
                'family_offenses',
                'loitering',
                'bad_checks',
                'trea',
                'gambling',
                'runaway',
                'bribery',
                'prostitution',
                'pornofraphy',
                'sex_offenses_non_forcible',
                'non_forcible',
                'suicide',
                'extortion'
            ),
            allowNull: true
        },
        description: { type: sequelize.STRING(4096), allowNull: true },
        date: { type: sequelize.DATE, allowNull: true },
        resolution: { type: sequelize.STRING(4096), allowNull: true },
        address: { type: sequelize.STRING(4096), allowNull: true },

        geo: { type: sequelize.JSON, allowNull: true },

        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE
    });

    await queryInterface.addIndex('incidents', ['account', 'importId'], { indicesType: 'UNIQUE' });
}