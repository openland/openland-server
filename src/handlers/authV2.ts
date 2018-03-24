import fetch from 'node-fetch';
import * as jwt from 'express-jwt';
import * as jwksRsa from 'jwks-rsa';
import * as express from 'express';
import { DB } from '../tables';
import { Profile } from './Profile';
import { Repos } from '../repositories';

//
// Main JWT verifier
//

export const JWTChecker = jwt({
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
    issuer: `https://auth.openland.com/`,
    algorithms: ['RS256'],
});

//
// OpenToken checker
//

export const TokenChecker = async function (req: express.Request, response: express.Response, next: express.NextFunction) {
    try {
        let accessToken = req.headers['x-openland-token'];
        if (accessToken) {
            let uid = await Repos.Tokens.fetchUserByToken(accessToken as string);
            if (uid !== null) {
                req.user = { id: uid };
            }
        }
    } catch (e) {
        console.warn(e);
        response.status(500).send({ error: 'Internal server error' });
        return;
    }
    next();
};

//
// Authenticator
//

export const Authenticator = async function (req: express.Request, response: express.Response) {
    try {
        console.warn('auth1');
        //
        // Fetching Profile Info
        //
        let accessToken = req.headers['x-openland-access-token'];
        let res = await fetch('https://auth.openland.com/userinfo', {
            headers: {
                authorization: 'Bearer ' + accessToken
            }
        });
        let profile = await res.json<Profile>();

        let firstName = 'No Name';
        let lastName = '';
        if (profile.nickname) {
            firstName = profile.nickname;
        }
        if (profile.given_name) {
            firstName = profile.given_name;
        }
        if (profile.family_name) {
            lastName = profile.family_name;
        }

        console.warn('auth2');
        console.warn(profile);

        //
        // Get Or Create User
        //
        let uid = await DB.tx(async () => {
            let userKey = req.user.sub;
            let user = await DB.User.find({
                where: {
                    authId: userKey
                }
            });
            if (user != null) {
                await DB.User.update({
                    firstName: firstName,
                    lastName: lastName,
                    email: profile.email,
                    picture: profile.picture
                }, {
                        where: {
                            authId: userKey
                        },
                    });
                return user.id!!;
            } else {
                return (await DB.User.create({
                    authId: userKey,
                    firstName: firstName,
                    lastName: lastName,
                    email: profile.email,
                    picture: profile.picture
                })).id!!;
            }
        });

        //
        // Create New Token
        //

        let token = await Repos.Tokens.createToken(uid);

        response.json({ ok: true, token: token });
    } catch (e) {
        console.warn(e);
        response.status(500).send({ error: 'Internal server error' });
    }
};