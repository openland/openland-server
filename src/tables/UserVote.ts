import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface UserVoteAttributes {
    userId?: number;
    vote?: number;
}

export interface UserVote extends sequelize.Instance<UserVoteAttributes>, UserVoteAttributes { }

export const UserVoteTable = connection.define<UserVote, UserVoteAttributes>('user_vote', {
    userId: {
        type: sequelize.INTEGER, references: {
            model: 'user',
            key: 'id',
        }
    },
    vote: {
        type: sequelize.INTEGER, references: {
            model: 'vote',
            key: 'id',
        }
    }
}, { indexes: [{ unique: true, fields: ['userId', 'vote'] }] })