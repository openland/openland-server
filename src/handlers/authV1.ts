import fetch from 'node-fetch';
import * as jwt from 'express-jwt';
import * as jwksRsa from 'jwks-rsa';
import * as express from 'express';
import { DB } from '../tables';
import { Profile } from './Profile';

//
// Main JWT verifier
//

export const JWTChecker = jwt({
    // Dynamically provide a signing key
    // based on the kid in the header and 
    // the singing keys provided by the JWKS endpoint.
    secret: (<any> jwksRsa).expressJwtSecret({
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

//
// Authenticator
//

export const Authenticator = async function (req: express.Request, response: express.Response) {
    let accessToken = req.headers['access-token'];
    let res = await fetch('https://statecraft.auth0.com/userinfo', {
        headers: {
            authorization: 'Bearer ' + accessToken
        }
    });
    let b = await res.json<Profile>();
    await DB.tx(async () => {
        let userKey = req.user.sub;
        let user = await DB.User.find({
            where: {
                authId: userKey
            }
        });
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
            });
        }
    });
    response.json({ ok: true });
};