import express from 'express';
import { randomString } from '../utils/random';
import { Emails } from '../services/Emails';
import { DB } from '../tables';
import * as base64 from '../utils/base64';
import { randomBytes } from 'crypto';
import { Repos } from '../repositories';

export async function sendCode(req: express.Request, response: express.Response) {
    let {
        email,
        phone
    } = req.body;

    console.log('auth_sendCode', JSON.stringify(req.body));

    if (!email && !phone) {
        response.json({ ok: false });
        return;
    }

    let code = randomString(5);

    if (email) {
        await Emails.sendDebugEmail(email, 'Your code: ' + code);

        let session = await DB.AuthSession.create({
            sessionSalt: base64.encodeBuffer(randomBytes(64)),
            code,
            codeExpires: new Date(Date.now() + 1000 * 60 * 5), // 5 minutes
            extras: {
                email
            }
        });

        response.json({ ok: true, session: session.sessionSalt });
    } else if (phone) {
        console.log(phone);
        response.json({ ok: false });
    }
}

export async function checkCode(req: express.Request, response: express.Response) {
    let {
        session,
        code
    } = req.body;

    if (!session && !code) {
        response.json({ ok: false });
        return;
    }

    let authSession = await DB.AuthSession.findOne({ where: { sessionSalt: session } });

    // No session found
    if (!authSession) {
        response.json({ ok: false });
        return;
    }

    // Code expired
    if (new Date() > authSession.codeExpires!) {
        response.json({ ok: false });
        return;
    }

    // Wrong code
    if (authSession.code! !== code) {
        response.json({ ok: false });
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
        response.json({ ok: false });
        return;
    }

    let authSession = await DB.AuthSession.findOne({ where: { sessionSalt: session, extras: { authToken } } });

    // No session found
    if (!authSession) {
        response.json({ ok: false });
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
        response.json({ ok: false });
    }
}