import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface Geo {
    latitude: number;
    longitude: number;
}

export type IncidentCategory =
    'robbery' |
    'assault' |
    'secondary_codes' |
    'non_criminal' |
    'vandalism' |
    'burglary' |
    'larceny' |
    'drug' |
    'warrants' |
    'vehicle_theft' |
    'other_offenses' |
    'weapon_laws' |
    'arson' |
    'missing_person' |
    'driving_under_the_influence' |
    'suspicious_occ' |
    'recovered_vehicle' |
    'drunkenness' |
    'trespass' |
    'fraud' |
    'disorderly_conduct' |
    'counterfeiting' |
    'kidnapping' |
    'embezzlement' |
    'stolen_property' |
    'liquor_laws' |
    'family_offenses' |
    'loitering' |
    'bad_checks' |
    'trea' |
    'gambling' |
    'runaway' |
    'bribery' |
    'prostitution' |
    'pornofraphy' |
    'sex_offenses_forcible' |
    'sex_offenses_non_forcible' |
    'non_forcible' |
    'suicide' |
    'extortion';

//     'NON-CRIMINAL' 'ROBBERY' 'ASSAULT' 'SECONDARY CODES' 'VANDALISM'
//  'BURGLARY' 'LARCENY/THEFT' 'DRUG/NARCOTIC' 'WARRANTS' 'VEHICLE THEFT'
//  'OTHER OFFENSES' 'WEAPON LAWS' 'ARSON' 'MISSING PERSON'
//  'DRIVING UNDER THE INFLUENCE' 'SUSPICIOUS OCC' 'RECOVERED VEHICLE'
//  'DRUNKENNESS' 'TRESPASS' 'FRAUD' 'DISORDERLY CONDUCT'
//  'SEX OFFENSES, FORCIBLE' 'FORGERY/COUNTERFEITING' 'KIDNAPPING'
//  'EMBEZZLEMENT' 'STOLEN PROPERTY' 'LIQUOR LAWS' 'FAMILY OFFENSES'
//  'LOITERING' 'BAD CHECKS' 'TREA' 'GAMBLING' 'RUNAWAY' 'BRIBERY'
//  'PROSTITUTION' 'PORNOGRAPHY/OBSCENE MAT' 'SEX OFFENSES, NON FORCIBLE'
//  'SUICIDE' 'EXTORTION'

export interface IncidentAttributes {
    id?: number | null;
    account?: number | null;
    incidentNumber?: string | null;
    category?: IncidentCategory | null;
    description?: string | null;
    date?: string | null;
    resolution?: string | null;
    address?: string | null;
    geo?: Geo | null;
    importId?: string | null;
}

export interface Incident extends sequelize.Instance<IncidentAttributes>, IncidentAttributes {

}

export const IncidentTable = connection.define<Incident, IncidentAttributes>('incident', {

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
            'sex_offenses_forcible',
            'sex_offenses_non_forcible',
            'counterfeiting',
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
}, {
        indexes: [
            { unique: true, fields: ['account', 'importId'] }]
    });