import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserProfileTable } from './UserProfile';

export interface PrivateCallAttributes {
    id: number;
    callerId: number;
    callerTimeout: Date;
    calleeId: number;
    calleeTimeout: Date | null;
    active: boolean;
}

export interface PrivateCall extends sequelize.Instance<Partial<PrivateCallAttributes>>, PrivateCallAttributes {
}

export const PrivateCallTable = connection.define<PrivateCall, Partial<PrivateCallAttributes>>('private_call', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    callerTimeout: { type: sequelize.DATE, allowNull: false },
    calleeTimeout: { type: sequelize.DATE, allowNull: true },
    active: { type: sequelize.BOOLEAN, allowNull: false, defaultValue: true }
});

PrivateCallTable.belongsTo(UserProfileTable, { as: 'caller' });
PrivateCallTable.belongsTo(UserProfileTable, { as: 'callee' });