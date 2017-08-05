import * as sequelize from 'sequelize'
import * as cls from 'continuation-local-storage';

var namespace = cls.createNamespace('tx-namespace');
(<any>sequelize).useCLS(namespace)

export var connection: sequelize.Sequelize

if (process.env.DATABASE_URL != undefined) {
    connection = new sequelize(process.env.DATABASE_URL!);
} else {
    connection = new sequelize('postgres', 'steve', '', {
        host: 'localhost',
        dialect: 'postgres'
    });
}

require('./tables')