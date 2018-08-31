import sequelize from 'sequelize';
import '../utils/sequelize_afterCommit';
import * as cls from 'continuation-local-storage';
import umzug from 'umzug';

var namespace = cls.createNamespace('tx-namespace');
(<any>sequelize).useCLS(namespace);

export var connection: sequelize.Sequelize;

if (process.env.DATABASE_URL !== undefined) {
    connection = new sequelize(process.env.DATABASE_URL!, {
        dialect: 'postgres',
        benchmark: process.env.DATABASE_LOGGING !== 'false',
        logging: process.env.DATABASE_LOGGING !== 'false',
        dialectOptions: {
            ssl: true
        },
        pool: {
            max: 20,
            acquire: 10000
        }
    });
} else if (process.env.DATABASE_PASSWORD !== undefined && process.env.DATABASE_USER !== undefined) {
    connection = new sequelize('postgres', process.env.DATABASE_USER!, process.env.DATABASE_PASSWORD!, {
        dialect: 'postgres',
        benchmark: process.env.DATABASE_LOGGING !== 'false',
        logging: process.env.DATABASE_LOGGING !== 'false',
        pool: {
            max: 20,
            acquire: 10000
        }
    });
} else {
    connection = new sequelize('postgres', process.env.DATABASE_USER!, '', {
        host: 'localhost',
        port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT!!, 10) : 5432,
        dialect: 'postgres',
        benchmark: process.env.DATABASE_LOGGING !== 'false',
        logging: process.env.DATABASE_LOGGING !== 'false',
        pool: {
            max: 20,
            acquire: 10000
        }
    });
}

require('../tables');

let migrator = new umzug({
    storage: 'sequelize',
    storageOptions: {
        sequelize: connection
    },
    migrations: {
        params: [connection.getQueryInterface(), sequelize],
        path: __dirname + '/../tables/migrations'
    }
});

export async function migrate() {
    await migrator.up();
}

export async function reset() {
    let args = { to: 0 };
    await migrator.down(<any>args);
}