import { connection } from '../connector';
import * as sequelize from 'sequelize'
import { User, Vote } from './'

export const UserVote = connection.define('user_vote', {
    userId: {
        type: sequelize.INTEGER, references: {
            model: User,
            key: 'id',
        }
    },
    vote: {
        type: sequelize.INTEGER, references: {
            model: Vote,
            key: 'id',
        }
    }
}, { indexes: [{ unique: true, fields: ['userId', 'vote'] }] })