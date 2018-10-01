import express from 'express';
import { randomString } from '../utils/random';
import { Emails } from '../services/Emails';
import { DB } from '../tables';
import * as base64 from '../utils/base64';
import { randomBytes } from 'crypto';
import { Repos } from '../repositories';
import { AuthSession } from '../tables/AuthSession';
import { getTestPhoneCode, isTestPhone } from '../repositories/PhoneRepository';
import { Services } from '../services';

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

const TEST_EMAIL_REGEX = /^test(\d{4})@openland.com$/;

const isTestEmail = (email: string) => {
    return TEST_EMAIL_REGEX.test(email);
};

const testEmailCode = (email: string) => {
    let [, num] = TEST_EMAIL_REGEX.exec(email)!;

    return num[num.length - 1].repeat(5);
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
        let isTest = isTestEmail(email);

        if (!isTest) {
            await Emails.sendDebugEmail(email, 'Your code: ' + code);
        } else {
            code = testEmailCode(email);
        }

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
        if (!Repos.Phones.checkPhone(phone)) {
            sendError(response, 0);
            return;
        }

        let isTest = isTestPhone(phone);

        if (!isTest) {
            await Services.TeleSign.sendSMS(phone, 'Your code: ' + code);
        } else {
            code = getTestPhoneCode(phone);
        }

        if (!authSession!) {
            authSession = await DB.AuthSession.create({
                sessionSalt: base64.encodeBuffer(randomBytes(64)),
                code,
                codeExpires: new Date(Date.now() + 1000 * 60 * 5), // 5 minutes
                extras: {
                    phone
                }
            });
        } else {
            await authSession!.update({ code });
        }

        response.json({ ok: true, session: authSession!.sessionSalt });
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
    } else if (authSession.extras!.phone) {
        let existing = await DB.Phone.findOne({ where: { phone: authSession.extras!.phone as any } });

        if (existing) {
            let token = await Repos.Tokens.createToken(existing.userId!);
            response.json({ ok: true, accessToken: token });
            await authSession.destroy();
            return;
        } else {
            let user = await DB.User.create({
                authId: 'phone|' + authSession.extras!.phone,
                email: '',
            });
            await DB.Phone.create({
                phone: authSession.extras!.phone as any,
                status: 'VERIFIED',
                userId: user.id
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