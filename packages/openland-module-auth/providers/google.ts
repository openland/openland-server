import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import express from 'express';
import { Modules } from '../../openland-modules/Modules';
import { createNamedContext } from '@openland/context';
import { OAuth2Client } from 'google-auth-library';

const rootCtx = createNamedContext('auth-email');
var client: OAuth2Client;

const Errors = {
    no_id_token: 'An unexpected error occurred. Please try again.',
    no_email_scope: 'An unexpected error occurred. Please try again.',
    server_error: 'An unexpected error occurred. Please try again.',
};

type ErrorsEnum = keyof typeof Errors;

const sendError = (response: express.Response, error: ErrorsEnum) => {
    if (!Errors[error]) {
        response.json({ ok: false, errorCode: 'server_error', errorText: Errors.server_error });
    }
    response.json({ ok: false, errorCode: error, errorText: Errors[error] });
};

export async function getAccessToken(req: express.Request, response: express.Response) {
    let {
        idToken
    } = req.body;

    if (!idToken) {
        sendError(response, 'no_id_token');
        return;
    }

    const clientIdWeb = await Modules.Super.getEnvVar<string>(rootCtx, 'auth-google-web-client-id') || '';
    if (!client) {
        client = new OAuth2Client(clientIdWeb);
    }

    const ticket = await client.verifyIdToken({
        idToken,
        audience: [
            clientIdWeb,
            await Modules.Super.getEnvVar<string>(rootCtx, 'auth-google-android-client-id-debug') || '',
            await Modules.Super.getEnvVar<string>(rootCtx, 'auth-google-android-client-id') || '',
            // TODO: add ios client_id
        ],
    });
    const payload = ticket.getPayload();

    await inTx(rootCtx, async (ctx) => {
        if (payload) {
            if (!payload.email) {
                sendError(response, 'no_email_scope');
                return;
            }
            const email = payload.email.toLowerCase();
            let existing = await Store.User.email.find(ctx, email);
            if (existing) {
                let token = await Modules.Auth.createToken(ctx, existing.id!);
                response.json({ ok: true, accessToken: token.salt });
                return;
            } else {
                let user = await Modules.Users.createUser(ctx, payload.sub, email as string);

                await Modules.Users.saveProfilePrefill(ctx, user.id, {
                    firstName: payload.given_name,
                    lastName: payload.family_name,
                    picture: payload.picture
                });

                await Modules.Hooks.onSignUp(ctx, user.id);
                let token = await Modules.Auth.createToken(ctx, user.id!);
                response.json({ ok: true, accessToken: token.salt });
                return;
            }
        } else {
            sendError(response, 'server_error');
        }
    });
}