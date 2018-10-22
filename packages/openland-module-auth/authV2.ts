import fetch from 'node-fetch';
import jwt from 'express-jwt';
import * as jwksRsa from 'jwks-rsa';
import * as express from 'express';
import { DB } from '../openland-server/tables';
import { Profile } from './Profile';
import { fetchKeyFromRequest } from '../openland-utils/fetchKeyFromRequest';
import { Emails } from '../openland-server/services/Emails';
import { Modules } from 'openland-modules/Modules';

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
        let accessToken = fetchKeyFromRequest(req, 'x-openland-token');
        if (accessToken) {
            let uid = await Modules.Auth.findToken(accessToken as string);
            if (uid !== null) {
                req.user = { uid: uid.uid, tid: uid.uid };
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

        // let r = await (await fetch('https://statecraft.auth0.com/api/v2/users/' + (profile as any).sub, {
        //     method: 'GET',
        //     headers: {
        //         authorization: 'Bearer <TOKEN>'
        //     }
        // })).json();
        // console.warn(r);

        let firstName: string | null = null;
        let lastName: string | null = null;
        if (profile.nickname) {
            firstName = profile.nickname;
        }
        if (profile.given_name) {
            firstName = profile.given_name;
        }
        if (profile.family_name) {
            lastName = profile.family_name;
        }

        //
        // Get Or Create User
        //
        let uid = await DB.tx(async (tx) => {
            let userKey = req.user.sub;

            let isNewAccount = false;

            let sequelize = DB.connection;
            // Account
            let user = await DB.User.find({
                where: [
                    sequelize.or(
                        {
                            email: profile.email.toLowerCase()
                        },
                        {
                            authId: userKey
                        }

                    )],
                order: [['createdAt', 'ASC']],
                transaction: tx
            });
            if (user === null) {
                user = (await DB.User.create({ authId: userKey, email: profile.email.toLowerCase(), }, { transaction: tx }));
                isNewAccount = true;
            }

            // Prefill
            let prefill = await DB.UserProfilePrefill.find({ where: { userId: user.id!! }, transaction: tx });
            if (!prefill) {
                await DB.UserProfilePrefill.create({
                    userId: user.id!!,
                    firstName: firstName,
                    lastName: lastName,
                    picture: profile.picture
                }, { transaction: tx });
            }

            if (isNewAccount) {
                await Emails.sendWelcomeEmail(user.id!, tx);
            }

            return user.id!!;
        });

        //
        // Create New Token
        //

        let token = await Modules.Auth.createToken(uid);

        response.json({ ok: true, token: token });
    } catch (e) {
        console.warn(e);
        response.status(500).send({ error: 'Internal server error' });
    }
};