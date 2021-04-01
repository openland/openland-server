import { Store } from './../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import fetch from 'node-fetch';
import jwt from 'express-jwt';
import * as jwksRsa from 'jwks-rsa';
import * as express from 'express';
import { Profile } from './utils/Profile';
import { fetchKeyFromRequest } from '../openland-utils/fetchKeyFromRequest';
import { Modules } from 'openland-modules/Modules';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';

const rootContext = createNamedContext('auth-v2');
const logger = createLogger('auth-v2');

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

export const TokenChecker = async function (req: express.Request, response: express.Response) {
    try {
        let accessToken = fetchKeyFromRequest(req, 'x-openland-token');
        if (accessToken) {
            let uid = await Modules.Auth.findToken(accessToken as string);
            if (uid !== null) {
                (req as any).user = { uid: uid.uid, tid: uid.uuid };
            }
        }
    } catch (e) {
        logger.warn(rootContext, e);
        response.status(500).send({ error: 'Internal server error' });
        return;
    }
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
        let uid = await inTx(rootContext, async (ctx) => {
            let userKey = (req as any).user.sub;

            // Account
            let user = await Store.User.email.find(ctx, profile.email.toLowerCase());
            if (!user) {
                user = await Modules.Users.createUser(ctx, {email: profile.email.toLowerCase(), googleId: userKey});
            }

            // Prefill
            await Modules.Users.saveProfilePrefill(ctx, user!.id, {
                firstName: firstName ? firstName : undefined,
                lastName: lastName ? lastName : undefined,
                picture: profile.picture
            });

            return user!.id;
        });

        //
        // Create New Token
        //

        let token = await Modules.Auth.createToken(rootContext, uid);

        response.json({ ok: true, token: token.salt });
    } catch (e) {
        logger.warn(rootContext, e, 'authentication_error');
        response.status(500).send({ error: 'Internal server error' });
    }
};
