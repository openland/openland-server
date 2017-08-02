import { graphqlExpress, graphiqlExpress } from "apollo-server-express";
import * as bodyParser from "body-parser";
import * as express from "express";
import * as Schema from './schema';
import * as cors from 'cors';
import { Context } from './Models/Context';
import * as jwt from 'express-jwt'
import * as jwksRsa from 'jwks-rsa'

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

function context(src: express.Request): Context {
    if (src.user != null && src.user != undefined) {
        return {
            userKey: src.user.sub
        }
    } else {
        return {}
    }
}

export default async function () {
    const app = express();

    // Routes
    app.use(cors())
    app.use("/graphql", checkJwt, bodyParser.json(), graphqlExpress((req: express.Request) => ({ schema: Schema.Schema, context: context(req) })));
    app.use('/sandbox', checkJwt, graphiqlExpress({ endpointURL: '/graphql' }));

    // Starting Api
    var port = process.env.PORT
    var dport = 9000
    if (port != undefined && port != "") {
        dport = parseInt(process.env.PORT as string)
    }
    app.listen(dport);
}
