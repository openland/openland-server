import fetch from 'node-fetch';
import jwt from 'express-jwt';
import * as jwksRsa from 'jwks-rsa';
import * as express from 'express';
import { Profile } from './Profile';
import { fetchKeyFromRequest } from '../openland-utils/fetchKeyFromRequest';
import { Emails } from '../openland-server/services/Emails';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';

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
        let uid = await inTx(async () => {
            let userKey = req.user.sub;

            let isNewAccount = false;

            // Account
            let user = (await FDB.User.findAll()).find((v) => v.email === profile.email.toLowerCase() || v.authId === userKey);
            if (user === null) {
                let c = (await FDB.Sequence.findById('user-id'))!;
                let id = ++c.value;
                user = (await FDB.User.create(id, { authId: userKey, email: profile.email.toLowerCase(), isBot: false, status: 'pending' }));
                await user.flush();
                isNewAccount = true;
            }

            // Prefill
            await Modules.Users.saveProfilePrefill(user!.id, {
                firstName: firstName ? firstName : undefined,
                lastName: lastName ? lastName : undefined,
                picture: profile.picture
            });

            if (isNewAccount) {
                await Emails.sendWelcomeEmail(user!.id);
            }

            return user!.id;
        });

        //
        // Create New Token
        //

        let token = await Modules.Auth.createToken(uid);

        response.json({ ok: true, token: token.salt });
    } catch (e) {
        console.warn('authenticator_error', e);
        response.status(500).send({ error: 'Internal server error' });
    }
};