import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable } from './User';
import { JsonMap } from '../utils/json';

export interface UserSettingsAttributes {
    id: number;
    userId: number;
    settings: JsonMap;
}

export interface UserSettings extends sequelize.Instance<Partial<UserSettingsAttributes>>, UserSettingsAttributes {

}

export const UserSettingsTable = connection.define<UserSettings, Partial<UserSettingsAttributes>>('user_settings', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    settings: { type: sequelize.JSON, allowNull: false, defaultValue: {} },
});

UserSettingsTable.belongsTo(UserTable, { as: 'user' });