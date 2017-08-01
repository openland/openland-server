import * as sequelize from 'sequelize'

export var connection: sequelize.Sequelize

if (process.env.DATABASE_URL != undefined) {
    connection = new sequelize(process.env.DATABASE_URL!);
} else {
    connection = new sequelize('postgres', 'steve', '', {
        host: 'localhost',
        dialect: 'postgres'
    });
}

export const Vote = connection.define('vote', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
})

export const User = connection.define('user', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    authId: { type: sequelize.STRING, unique: true }
})

export const Votes = connection.define('votes', {
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
},{ indexes: [{ unique: true, fields: ['userId', 'vote'] }] })