import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable, User } from './User';
import { OrganizationTable, Organization } from './Organization';

export interface ConversationAttributes {
    id: number;
    title: string;
    seq: number;
    type: 'anonymous' | 'private' | 'shared';
    member1Id: number | null;
    member2Id: number | null;
    organization1Id: number | null;
    organization2Id: number | null;
}

export interface Conversation extends sequelize.Instance<Partial<ConversationAttributes>>, ConversationAttributes {
    organization1: Organization | null | undefined;
    organization2: Organization | null | undefined;
    member1: User | null | undefined;
    member2: User | null | undefined;
    getOrganization1(options?: any): Promise<Organization | null>;
    getOrganization2(options?: any): Promise<Organization | null>;
    getMember1(options?: any): Promise<User | null>;
    getMember2(options?: any): Promise<User | null>;
}

export const ConversationTable = connection.define<Conversation, Partial<ConversationAttributes>>('conversation', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    title: {
        type: sequelize.STRING, allowNull: false, validate: {
            notEmpty: true
        }
    },
    seq: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
    type: { type: sequelize.STRING, defaultValue: 'anonymous', allowNull: false }
}, {
        paranoid: true, validate: {
            validateMemberOrder() {
                if (this.type === 'private') {
                    if (!this.member1Id || !this.member2Id) {
                        throw Error('Members must be set for private conversations');
                    }
                    if (this.member1Id > this.member2Id) {
                        throw Error('Constraint member1Id <= member2Id failed');
                    }
                }
            },
            validateOrgOrder() {
                if (this.type === 'shared') {
                    if (!this.organization1Id || !this.organization2Id) {
                        throw Error('Organizations must be set for shared conversations');
                    }
                    if (this.organization1Id > this.organization2Id) {
                        throw Error('Constraint organization1Id <= organization2Id failed');
                    }
                }
            }
        }
    });

ConversationTable.belongsTo(UserTable, { as: 'member1' });
ConversationTable.belongsTo(UserTable, { as: 'member2' });

ConversationTable.belongsTo(OrganizationTable, { as: 'organization1' });
ConversationTable.belongsTo(OrganizationTable, { as: 'organization2' });