import express from 'express';
import { randomNumbersString } from '../../openland-utils/random';
import { Emails } from '../../openland-module-email/Emails';
import * as base64 from '../../openland-utils/base64';
import { randomBytes } from 'crypto';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { AuthCodeSession } from 'openland-module-db/schema';
import { calculateBase64len } from '../../openland-utils/base64';
import { FDB } from 'openland-module-db/FDB';
import { createEmptyContext } from 'openland-utils/Context';

const Errors = {
    wrong_arg: { code: 0, text: 'Wrong arguments passed' },
    server_error: { code: 1, text: 'Server error' },
    session_not_found: { code: 2, text: 'Session not found' },
    code_expired: { code: 3, text: 'Code expired' },
    wrong_code: { code: 4, text: 'Wrong code' },
    no_email_or_phone: { code: 5, text: 'No email or phone passed' },
    no_session: { code: 6, text: 'No session passed' },
    no_code: { code: 7, text: 'No code passed' },
    no_auth_token: { code: 8, text: 'No authToken passed' },
    invalid_email: { code: 9, text: 'Invalid email' },
    invalid_auth_token: { code: 10, text: 'Invalid auth token' },
    session_expired: { code: 11, text: 'Session expired' },
    wrong_code_length: { code: 4, text: 'Wrong code length' },
};

const CODE_LEN = 5;

const sendError = (response: express.Response, error: { code: number, text: string }) => {
    response.json({ ok: false, errorCode: error.code, errorText: error.text });
};

const TEST_EMAIL_REGEX = /^test(\d{4})@openland.com$/;

const isTestEmail = (email: string) => {
    if (email === 'appstore@apple.com') {
        return true;
    }

    return TEST_EMAIL_REGEX.test(email);
};

const testEmailCode = (email: string) => {
    if (email === 'appstore@apple.com') {
        return '11111';
    }

    let [, num] = TEST_EMAIL_REGEX.exec(email)!;

    return num[num.length - 1].repeat(5);
};

const checkEmail = (email: any) => typeof email === 'string' && email.length <= 254; // according to rfc

const checkSession = (session: any) => typeof session === 'string' && session.length === calculateBase64len(64);

const checkAuthToken = (session: any) => typeof session === 'string' && session.length === calculateBase64len(64);

export function withAudit(handler: (req: express.Request, response: express.Response) => void) {
    return async (req: express.Request, response: express.Response) => {
        let oldEnd = response.end;

        // let data: Buffer;

        (response.end as any) = (chunk: any, ...rest: any[]) => {
            //  data = chunk;
            oldEnd.call(response, chunk, ...rest);
        };

        await handler(req, response);

        // let ip = req.ip;
        // await DB.AuthAudit.create({
        //     ip,
        //     method: req.path,
        //     request: JSON.stringify(req.body),
        //     response: JSON.stringify(data!.toString())
        // });
    };
}

export async function sendCode(req: express.Request, response: express.Response) {
    let {
        email,
        phone,
        session
    } = req.body;
    await inTx(createEmptyContext(), async (ctx) => {
        let authSession: AuthCodeSession | undefined;
        if (session) {
            if (!checkSession(session)) {
                sendError(response, Errors.session_not_found);
                return;
            }

            let existing = await Modules.Auth.findAuthSession(ctx, session);
            if (!existing) {
                sendError(response, Errors.session_not_found);
                return;
            }
            authSession = existing;
        }

        if (!email && !phone) {
            sendError(response, Errors.no_email_or_phone);
            return;
        }

        let code = randomNumbersString(CODE_LEN);

        if (email) {
            if (!checkEmail(email)) {
                sendError(response, Errors.invalid_email);
            }

            email = (email as string).toLowerCase().trim();
            let isTest = isTestEmail(email);

            if (!isTest) {
                await Emails.sendActivationCodeEmail(ctx, email, code);
            } else {
                code = testEmailCode(email);
            }

            if (!authSession) {
                authSession = await Modules.Auth.createEmailAuthSession(ctx, email, code);
            } else {
                authSession.code = code;
            }

            response.json({ ok: true, session: authSession!.uid });
            return;
        } else {
            sendError(response, Errors.server_error);
        }
    });
}

export async function checkCode(req: express.Request, response: express.Response) {
    let {
        session,
        code
    } = req.body;

    if (!session) {
        sendError(response, Errors.no_session);
        return;
    } else if (!checkSession(session)) {
        sendError(response, Errors.session_not_found);
        return;
    }

    if (!code) {
        sendError(response, Errors.no_code);
        return;
    }

    if (typeof code !== 'string') {
        sendError(response, Errors.wrong_code);
        return;
    }

    code = code.trim();
    if (code.length !== CODE_LEN) {
        sendError(response, Errors.wrong_code_length);
        return;
    }

    let res = await inTx(createEmptyContext(), async (ctx) => {
        let authSession = await Modules.Auth.findAuthSession(ctx, session);

        // No session found
        if (!authSession) {
            sendError(response, Errors.session_not_found);
            return;
        }

        // Code expired
        if (Date.now() > authSession.expires) {
            sendError(response, Errors.code_expired);
            return;
        }

        // Wrong code
        if (authSession.code! !== code) {
            sendError(response, Errors.wrong_code);
            return;
        }

        authSession.tokenId = base64.encodeBuffer(randomBytes(64));

        return authSession;
    });

    response.json({ ok: true, authToken: res!.tokenId });
}

export async function getAccessToken(req: express.Request, response: express.Response) {
    let {
        session,
        authToken
    } = req.body;

    if (!session) {
        sendError(response, Errors.no_session);
        return;
    } else if (!checkSession(session)) {
        sendError(response, Errors.no_session);
        return;
    }

    if (!authToken) {
        sendError(response, Errors.no_auth_token);
        return;
    } else if (!checkAuthToken(authToken)) {
        sendError(response, Errors.invalid_auth_token);
        return;
    }

    await inTx(createEmptyContext(), async (ctx) => {
        let authSession = await Modules.Auth.findAuthSession(ctx, session);

        // No session found
        if (!authSession) {
            sendError(response, Errors.session_not_found);
            return;
        }

        if (!authSession.enabled) {
            sendError(response, Errors.session_expired);
        }

        // Wrong auth token
        if (authSession.tokenId !== authToken) {
            sendError(response, Errors.invalid_auth_token);
            return;
        }

        if (authSession.email) {
            let existing = (await FDB.User.findAll(ctx))
                .find((v) => v.email === authSession!.email || v.authId === 'email|' + authSession!.email as any);

            if (existing) {
                let token = await Modules.Auth.createToken(ctx, existing.id!);
                response.json({ ok: true, accessToken: token.salt });
                authSession.enabled = false;
                return;
            } else {
                let user = await Modules.Users.createUser(ctx, 'email|' + authSession.email, authSession.email as string);
                let token = await Modules.Auth.createToken(ctx, user.id!);
                response.json({ ok: true, accessToken: token });
                authSession.enabled = false;
                return;
            }
        } else {
            sendError(response, Errors.server_error);
        }
    });
}