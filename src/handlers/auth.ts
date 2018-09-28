import express from 'express';
import { randomString } from '../utils/random';
import { Emails } from '../services/Emails';
import { DB } from '../tables';
import * as base64 from '../utils/base64';
import { randomBytes } from 'crypto';
import { Repos } from '../repositories';
import { AuthSession } from '../tables/AuthSession';

const ERROR_TEXT = {
    0: 'Wrong arguments passed',
    1: 'Server error',
    2: 'Session not found',
    3: 'Code expired',
    4: 'Wrong code',
};

const sendError = (response: express.Response, code: number) => {
    response.json({ ok: false, errorCode: code, errorText: (ERROR_TEXT as any)[code] });
};

export async function sendCode(req: express.Request, response: express.Response) {
    let {
        email,
        phone,
        session
    } = req.body;

    console.log('auth_sendCode', JSON.stringify(req.body));

    let authSession: AuthSession;

    if (session) {
        let existing = await DB.AuthSession.findOne({ where: { sessionSalt: session } });

        // No session found
        if (!existing) {
            sendError(response, 2);
            return;
        }
        authSession = existing;
    }

    if (!email && !phone) {
        sendError(response, 0);
        return;
    }

    let code = randomString(5);

    if (email) {
        await Emails.sendDebugEmail(email, 'Your code: ' + code);

        if (!authSession!) {
            authSession = await DB.AuthSession.create({
                sessionSalt: base64.encodeBuffer(randomBytes(64)),
                code,
                codeExpires: new Date(Date.now() + 1000 * 60 * 5), // 5 minutes
                extras: {
                    email
                }
            });
        } else {
            await authSession!.update({ code });
        }

        response.json({ ok: true, session: authSession!.sessionSalt });
    } else if (phone) {
        console.log(phone);
        sendError(response, 1);
    }
}

export async function checkCode(req: express.Request, response: express.Response) {
    let {
        session,
        code
    } = req.body;

    if (!session && !code) {
        sendError(response, 0);
        return;
    }

    let authSession = await DB.AuthSession.findOne({ where: { sessionSalt: session } });

    // No session found
    if (!authSession) {
        sendError(response, 2);
        return;
    }

    // Code expired
    if (new Date() > authSession.codeExpires!) {
        sendError(response, 3);
        return;
    }

    // Wrong code
    if (authSession.code! !== code) {
        sendError(response, 4);
        return;
    }

    authSession.extras!.authToken = base64.encodeBuffer(randomBytes(64));
    (authSession as any).changed('extras', true);
    await authSession.save();

    response.json({ ok: true, authToken: authSession.extras!.authToken });
}

export async function getAccessToken(req: express.Request, response: express.Response) {
    let {
        session,
        authToken
    } = req.body;

    if (!session && !authToken) {
        sendError(response, 0);
        return;
    }

    let authSession = await DB.AuthSession.findOne({ where: { sessionSalt: session, extras: { authToken } } });

    // No session found
    if (!authSession) {
        sendError(response, 2);
        return;
    }

    if (authSession.extras!.email) {
        let existing = await DB.User.findOne({ where: { email: authSession.extras!.email as any } });

        if (existing) {
            let token = await Repos.Tokens.createToken(existing.id!);
            response.json({ ok: true, accessToken: token });
            await authSession.destroy();
            return;
        } else {
            let user = await DB.User.create({
                authId: 'email|' + authSession.extras!.email,
                email: '',
            });
            let token = await Repos.Tokens.createToken(user.id!);
            response.json({ ok: true, accessToken: token });
            await authSession.destroy();
            return;
        }
    } else {
        sendError(response, 1);
    }
}