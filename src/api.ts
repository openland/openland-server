import { graphqlExpress, graphiqlExpress } from "apollo-server-express";
import { GraphQLOptions } from 'apollo-server-core';
import * as bodyParser from "body-parser";
import * as express from "express";
import * as Schema from './schema';
import * as cors from 'cors';
import { Context } from './Models/Context';
import * as jwt from 'express-jwt';
import * as jwksRsa from 'jwks-rsa';
import * as DB from './tables';

const checkJwt = jwt({
    // Dynamically provide a signing key
    // based on the kid in the header and 
    // the singing keys provided by the JWKS endpoint.
    secret: (<any>jwksRsa).expressJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://statecraft.auth0.com/.well-known/jwks.json`
    }),

    // Ignore missing auth
    credentialsRequired: false,

    // Validate the audience and the issuer.
    // audience: 'https://statecraft.auth0.com/userinfo',
    issuer: `https://statecraft.auth0.com/`,
    algorithms: ['RS256'],
});

async function context(src: express.Request): Promise<Context> {
    if (src.user != null && src.user != undefined) {
        var userKey = src.user.sub
        var userId: number = await DB.tx(async () => {
            var exists = await DB.User.find({
                where: {
                    authId: userKey
                }
            })
            var id: number
            if (exists == null) {
                var res = await DB.User.create({
                    authId: userKey
                })
                id = (<any>res).id
            } else {
                id = (<any>exists).id
            }
            return id
        })

        return {
            uid: userId
        }
    } else {
        return {}
    }
}

async function handleRequest(req: express.Request): Promise<GraphQLOptions> {
    var cont = await context(req)
    return { schema: Schema.Schema, context: cont }
}

export default async function () {
    const app = express();

    // Routes
    app.use(cors())
    app.use("/graphql", checkJwt, bodyParser.json(), graphqlExpress(handleRequest));
    app.use('/sandbox', checkJwt, graphiqlExpress({ endpointURL: '/graphql' }));

    var FOREST_ENV_SECRET = "831f4cf62bc3cb635214043c62961a8a23486c0f638f16ddee106653a5bc334c"
    if (process.env.FOREST_ENV_SECRET != "" && process.env.FOREST_ENV_SECRET != undefined) {
        FOREST_ENV_SECRET = process.env.FOREST_ENV_SECRET!
    }
    var FOREST_AUTH_SECRET = "tKGo4P00KjKOGHmuu3IdC6icwLNu3uFB"
    if (process.env.FOREST_AUTH_SECRET != "" && process.env.FOREST_AUTH_SECRET != undefined) {
        FOREST_ENV_SECRET = process.env.FOREST_AUTH_SECRET!
    }

    app.use(require('forest-express-sequelize').init({
        envSecret: FOREST_ENV_SECRET,
        authSecret: FOREST_AUTH_SECRET,
        sequelize: require('./connector').connection
    }));

    // Starting Api
    var port = process.env.PORT
    var dport = 9000
    if (port != undefined && port != "") {
        dport = parseInt(process.env.PORT as string)
    }
    app.listen(dport);
}
