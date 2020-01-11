import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import express from 'express';
import { randomNumbersString } from '../../openland-utils/random';
import { Emails } from '../../openland-module-email/Emails';
import * as base64 from '../../openland-utils/base64';
import { randomBytes } from 'crypto';
import { Modules } from 'openland-modules/Modules';
import { AuthCodeSession } from 'openland-module-db/store';
import { calculateBase64len } from '../../openland-utils/base64';
import { emailValidator } from '../../openland-utils/NewInputValidator';
import { createNamedContext } from '@openland/context';

const rootCtx = createNamedContext('auth-email');

const Errors = {
    wrong_arg: 'An unexpected error occurred. Please try again.',
    server_error: 'An unexpected error occurred. Please try again.',
    session_not_found: 'An unexpected error occurred. Please try again.',
    code_expired: 'This code has expired. Please click Resend and we\'ll send you a new verification email.',
    wrong_code: 'The code you entered is incorrect. Please check the code in the email and try again.',
    no_email_or_phone: 'Please enter your email address',
    no_session: 'An unexpected error occurred. Please try again.',
    no_code: 'Please enter the 6-digit code we\'ve just sent to your email',
    no_auth_token: 'An unexpected error occurred. Please try again.',
    invalid_email: 'It looks like this email is incorrect. Please check your email address and try again.',
    invalid_auth_token: 'An unexpected error occurred. Please try again.',
    session_expired: 'An unexpected error occurred. Please try again.',
    wrong_code_length: 'The code you entered is incorrect. Please check the code in the email and try again.',
};

type ErrorsEnum = keyof typeof Errors;

const CODE_LEN = 6;

const sendError = (response: express.Response, error: ErrorsEnum) => {
    if (!Errors[error]) {
        response.json({ ok: false, errorCode: 'server_error', errorText: Errors.server_error });
    }
    response.json({ ok: false, errorCode: error, errorText: Errors[error] });
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
        return '111111';
    }

    let [, num] = TEST_EMAIL_REGEX.exec(email)!;

    return num[num.length - 1].repeat(CODE_LEN);
};

const checkEmail = (email: any) => emailValidator(email, '') === true;

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
    await inTx(rootCtx, async (ctx) => {
        let authSession: AuthCodeSession | undefined;
        if (session) {
            if (!checkSession(session)) {
                sendError(response, 'session_not_found');
                return;
            }

            let existing = await Modules.Auth.findAuthSession(ctx, session);
            if (!existing) {
                sendError(response, 'session_not_found');
                return;
            }
            authSession = existing;
        }

        if (!email && !phone) {
            sendError(response, 'no_email_or_phone');
            return;
        }

        let code = randomNumbersString(CODE_LEN);

        if (email) {
            if (!checkEmail(email)) {
                sendError(response, 'invalid_email');
            }

            email = (email as string).toLowerCase().trim();
            let isTest = isTestEmail(email);
            let existing = !!(await Store.User.findAll(ctx)).find((v) => v.email === email || v.authId === 'email|' + email as any);

            if (!isTest) {
                await Emails.sendActivationCodeEmail(ctx, email, code, existing);
            } else {
                code = testEmailCode(email);
            }

            if (!authSession) {
                authSession = await Modules.Auth.createEmailAuthSession(ctx, email, code);
            } else {
                authSession.code = code;
            }

            response.json({ ok: true, session: authSession!.uid, isExistingUser: existing });
            return;
        } else {
            sendError(response, 'server_error');
        }
    });
}

export async function checkCode(req: express.Request, response: express.Response) {
    let {
        session,
        code
    } = req.body;

    if (!session) {
        sendError(response, 'no_session');
        return;
    } else if (!checkSession(session)) {
        sendError(response, 'session_not_found');
        return;
    }

    if (!code) {
        sendError(response, 'no_code');
        return;
    }

    if (typeof code !== 'string') {
        sendError(response, 'wrong_code');
        return;
    }

    code = code.trim();
    if (code.length !== CODE_LEN) {
        sendError(response, 'wrong_code_length');
        return;
    }

    let res = await inTx(rootCtx, async (ctx) => {
        let authSession = await Modules.Auth.findAuthSession(ctx, session);

        // No session found
        if (!authSession) {
            sendError(response, 'session_not_found');
            return;
        }

        // Code expired
        if (Date.now() > authSession.expires) {
            sendError(response, 'code_expired');
            return;
        }

        // Wrong code
        if (authSession.code! !== code) {
            sendError(response, 'wrong_code');
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
        sendError(response, 'no_session');
        return;
    } else if (!checkSession(session)) {
        sendError(response, 'no_session');
        return;
    }

    if (!authToken) {
        sendError(response, 'no_auth_token');
        return;
    } else if (!checkAuthToken(authToken)) {
        sendError(response, 'invalid_auth_token');
        return;
    }

    await inTx(rootCtx, async (ctx) => {
        let authSession = await Modules.Auth.findAuthSession(ctx, session);

        // No session found
        if (!authSession) {
            sendError(response, 'session_not_found');
            return;
        }

        if (!authSession.enabled) {
            sendError(response, 'session_expired');
        }

        // Wrong auth token
        if (authSession.tokenId !== authToken) {
            sendError(response, 'invalid_auth_token');
            return;
        }

        if (authSession.email) {
            let existing = await Store.User.email.find(ctx, authSession.email.toLowerCase());
            if (existing) {
                let token = await Modules.Auth.createToken(ctx, existing.id!);
                response.json({ ok: true, accessToken: token.salt });
                authSession.enabled = false;
                return;
            } else {
                let user = await Modules.Users.createUser(ctx, 'email|' + authSession.email, authSession.email as string);
                await Modules.Hooks.onSignUp(ctx, user.id);
                let token = await Modules.Auth.createToken(ctx, user.id!);
                response.json({ ok: true, accessToken: token.salt });
                authSession.enabled = false;
                return;
            }
        } else {
            sendError(response, 'server_error');
        }
    });
}