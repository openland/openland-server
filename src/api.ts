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
import * as morgan from 'morgan';
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
    var domain: string = "";
    if (src.headers["x-statecraft-domain"]) {
        domain = src.headers["x-statecraft-domain"] as string
    } else {
        throw Error("x-statecraft-domain header is not present")
    }

    var accId = (await DB.Account.findOne({
        where: {
            slug: domain,
            activated: true
        }
    }))
    if (accId == null) {
        throw new Error("404: Unable to find account " + domain)
    }

    var n = new Context();
    n.domain = domain
    n.accountId = accId.id!!
    n.owner = false

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

    if (n.uid != null) {
        var member = await DB.AccountMember.findOne({
            where: {
                accountId: n.accountId,
                userId: n.uid
            }
        })

        if (member) {
            n.owner = member.owner!!
        }
    }

    return n
}

async function handleRequest(req?: express.Request, res?: express.Response): Promise<GraphQLOptions> {
    if (req == undefined || res == undefined) {
        throw Error("Unexpected error!")
    } else {
        return { schema: Schema.Schema, context: res.locals.ctx }
    }
}

async function buildContext(req: express.Request, res: express.Response, next: express.NextFunction) {
    var ctx: Context
    try {
        ctx = await context(req);
    } catch (e) {
        res!!.status(404).send("Unable to find domain")
        return
    }
    res.locals.ctx = ctx
    next()
}

async function handleAdminRequest(req?: express.Request): Promise<GraphQLOptions> {
    return { schema: Schema.AdminSchema }
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

    // Allow All Domains
    app.use(cors())
    app.use(morgan("tiny"))

    // APIs
    app.use("/graphql", checkJwt, bodyParser.json(), buildContext, graphqlExpress(handleRequest));
    app.use("/api", checkJwt, bodyParser.json(), buildContext, graphqlExpress(handleRequest));
    app.use("/admin-api", checkJwt, bodyParser.json(), graphqlExpress(handleAdminRequest));

    // Sandbox
    app.use('/sandbox', checkJwt, graphiqlExpress({ endpointURL: '/admin-api' }));

    // Authentication
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

    // Starting Api
    var port = process.env.PORT
    var dport = 9000
    if (port != undefined && port != "") {
        dport = parseInt(process.env.PORT as string)
    }
    console.info("Binding to port " + dport);
    app.listen(dport);
}
