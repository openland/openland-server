import { graphqlExpress, graphiqlExpress } from "apollo-server-express";
import { GraphQLOptions } from 'apollo-server-core';
import * as bodyParser from "body-parser";
import * as express from "express";
import * as Schema from './schema';
import * as cors from 'cors';
import { Context } from './models/Context';
import * as jwt from 'express-jwt';
import * as jwksRsa from 'jwks-rsa';
import { DB } from './tables';
import * as fetch from 'node-fetch';

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
    var domain: string | undefined = undefined;
    if (src.headers["x-statecraft-domain"]) {
        domain = src.headers["x-statecraft-domain"] as string
    }

    var n = new Context();
    n.domain = domain

    if (src.user != null && src.user != undefined) {
        var userKey = src.user.sub
        var exists = await DB.User.find({
            where: {
                authId: userKey
            }
        })
        if (exists != null) {
            n.uid = exists.id!!
        }
    }

    return n
}

async function handleRequest(req?: express.Request): Promise<GraphQLOptions> {
    if (req == undefined) {
        return { schema: Schema.Schema, context: new Context() }
    } else {
        var cont = await context(req)
        return { schema: Schema.Schema, context: cont }
    }
}

interface Profile {
    name: string;
    given_name: string;
    family_name: string;
    nickname: string;
    picture: string;
    gender: string;
    email: string;
}

export default async function () {
    const app = express();

    // Routes
    app.use(cors())
    app.use("/graphql", checkJwt, bodyParser.json(), graphqlExpress(handleRequest));
    app.use('/sandbox', checkJwt, graphiqlExpress({ endpointURL: '/graphql' }));
    app.post('/auth', checkJwt, bodyParser.json(), async function (req: express.Request, response: express.Response) {
        var accessToken = req.headers['access-token']
        var res = await fetch.default('https://statecraft.auth0.com/userinfo', {
            headers: {
                authorization: 'Bearer ' + accessToken
            }
        })
        var b = await res.json<Profile>()
        await DB.tx(async () => {
            var userKey = req.user.sub
            var user = await DB.User.find({
                where: {
                    authId: userKey
                }
            })
            if (user != null) {
                await DB.User.update({
                    firstName: b.given_name,
                    lastName: b.family_name,
                    email: b.email,
                    picture: b.picture
                }, {
                        where: {
                            authId: userKey
                        },
                    });
            } else {
                await DB.User.create({
                    authId: userKey,
                    firstName: b.given_name,
                    lastName: b.family_name,
                    email: b.email,
                    picture: b.picture
                })
            }
        });
        response.json({ ok: true })
    })

    var FOREST_ENV_SECRET = "831f4cf62bc3cb635214043c62961a8a23486c0f638f16ddee106653a5bc334c"
    if (process.env.FOREST_ENV_SECRET != "" && process.env.FOREST_ENV_SECRET != undefined) {
        FOREST_ENV_SECRET = process.env.FOREST_ENV_SECRET!
    }
    var FOREST_AUTH_SECRET = "tKGo4P00KjKOGHmuu3IdC6icwLNu3uFB"
    if (process.env.FOREST_AUTH_SECRET != "" && process.env.FOREST_AUTH_SECRET != undefined) {
        FOREST_AUTH_SECRET = process.env.FOREST_AUTH_SECRET!
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
    console.info("Binding to port " + dport);
    app.listen(dport);
}
