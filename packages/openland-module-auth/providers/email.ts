import { Store } from './../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import express from 'express';
import { randomNumbersString } from '../../openland-utils/random';
import { Emails } from '../../openland-module-email/Emails';
import * as base64 from '../../openland-utils/base64';
import { randomBytes } from 'crypto';
import { Modules } from 'openland-modules/Modules';
import { AuthCodeSession, UserProfile } from 'openland-module-db/store';
import { calculateBase64len } from '../../openland-utils/base64';
import { emailValidator } from '../../openland-utils/NewInputValidator';
import { Context, createNamedContext } from '@openland/context';
import { createPersistenceThrottle } from '../../openland-utils/PersistenceThrottle';
import { doSimpleHash } from '../../openland-module-push/workers/PushWorker';
import { IDs } from '../../openland-module-api/IDs';
import { createTracer } from 'openland-log/createTracer';

const rootCtx = createNamedContext('auth-email');
const tracer = createTracer('auth-email');

const Errors = {
    wrong_arg: 'An unexpected error occurred. Please try again.',
    server_error: 'An unexpected error occurred. Please try again.',
    session_not_found: 'An unexpected error occurred. Please try again.',
    code_expired: 'This code has expired. Please click Resend and we\'ll send you a new verification email.',
    wrong_code: 'Wrong code',
    no_email_or_phone: 'Please enter your email address',
    no_session: 'An unexpected error occurred. Please try again.',
    no_code: 'Please enter the 6-digit code we\'ve just sent to your email',
    no_auth_token: 'An unexpected error occurred. Please try again.',
    invalid_email: 'It looks like this email is incorrect. Please check your email address and try again.',
    invalid_auth_token: 'An unexpected error occurred. Please try again.',
    session_expired: 'An unexpected error occurred. Please try again.',
    wrong_code_length: 'Wrong code',
    too_many_attempts: 'Too many requests. Try again later'
};

type ErrorsEnum = keyof typeof Errors;

const CODE_LEN = 6;

const sendError = (response: express.Response, error: ErrorsEnum, extra: any = {}) => {
    if (!Errors[error]) {
        response.json({ ok: false, errorCode: 'server_error', errorText: Errors.server_error });
    }
    response.json({ ok: false, errorCode: error, errorText: Errors[error], ...extra });
};

const TEST_EMAIL_REGEX = /^test(\d{6})@openland.com$/;

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

const emailThrottle = createPersistenceThrottle('auth_email');

export function withAudit(handler: (req: express.Request, response: express.Response) => void) {
    return async (req: express.Request, response: express.Response) => {
        let oldEnd = response.end;

        // let data: Buffer;

        (response.end as any) = (chunk: any, ...rest: any[]) => {
            //  data = chunk;
            (oldEnd as any).call(response, chunk, ...rest);
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

async function findUserByEmail(ctx: Context, email: string) {
    return await Store.User.email.find(ctx, email);
}

export async function sendCode(req: express.Request, response: express.Response) {
    await tracer.trace(rootCtx, 'send-code', async (parent) => {
        let {
            email,
            phone,
            session
        } = req.body;

        await inTx(parent, async (ctx) => {
            let authSession: AuthCodeSession | undefined;
            if (session) {
                if (!checkSession(session)) {
                    sendError(response, 'session_not_found');
                    return;
                }

                let existing = await Modules.Auth.findEmailAuthSession(ctx, session);
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
                    return;
                }

                email = (email as string).toLowerCase().trim();

                let nextEmailTime = await emailThrottle.nextFireTimeout(ctx, email);
                if (nextEmailTime > 0) {
                    sendError(response, 'too_many_attempts', { can_send_next_email_at: nextEmailTime });
                    return;
                }

                let isTest = isTestEmail(email);
                let existing = await findUserByEmail(ctx, email);

                if (!isTest) {
                    await Emails.sendActivationCodeEmail(ctx, email, code, !!existing);
                    await emailThrottle.onFire(ctx, email);
                } else {
                    code = testEmailCode(email);
                }

                if (!authSession) {
                    authSession = await Modules.Auth.createEmailAuthSession(ctx, email, code);
                } else {
                    authSession.code = code;
                    authSession.attemptsCount = 0;
                }

                let pictureId: string | undefined;
                let profile: UserProfile | null | undefined;
                if (existing) {
                    profile = await Store.UserProfile.findById(ctx, existing.id);
                    pictureId = profile && profile.picture && profile.picture.uuid;
                }

                response.json({
                    ok: true,
                    session: authSession!.uid,
                    profileExists: !!profile,
                    pictureId,
                    pictureHash: profile ? doSimpleHash(IDs.User.serialize(profile.id)) : null,
                    pictureCrop: profile && profile.picture && profile.picture.crop,
                    initials: profile ? ((profile.firstName || '').slice(0, 1) + ' ' + (profile.lastName || '').slice(0, 1)).toUpperCase() : null
                });
                return;
            } else {
                sendError(response, 'server_error');
            }
        });
    });
}

export async function checkCode(req: express.Request, response: express.Response) {
    await tracer.trace(rootCtx, 'check-code', async (parent) => {
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

        let res = await inTx(parent, async (ctx) => {
            let authSession = await Modules.Auth.findEmailAuthSession(ctx, session);

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

            // max 5 attempts
            if (authSession.attemptsCount && authSession.attemptsCount >= 5) {
                sendError(response, 'code_expired');
                return;
            }

            // Wrong code
            if (authSession.code! !== code) {
                if (authSession.attemptsCount) {
                    authSession.attemptsCount++;
                } else {
                    authSession.attemptsCount = 1;
                }
                sendError(response, 'wrong_code');
                return;
            }

            authSession.tokenId = base64.encodeBuffer(randomBytes(64));

            return authSession;
        });

        response.json({ ok: true, authToken: res!.tokenId });
    });
}

export async function getAccessToken(req: express.Request, response: express.Response) {
    await tracer.trace(rootCtx, 'get-token', async (parent) => {
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

        await inTx(parent, async (ctx) => {
            let authSession = await Modules.Auth.findEmailAuthSession(ctx, session);

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
                let email = authSession.email.toLowerCase();
                await emailThrottle.release(ctx, email);
                let existing = await findUserByEmail(ctx, email);
                if (existing) {
                    let token = await Modules.Auth.createToken(ctx, existing.id!);
                    response.json({ ok: true, accessToken: token.salt });
                    authSession.enabled = false;
                    return;
                } else {
                    let user = await Modules.Users.createUser(ctx, { email: authSession.email.toLowerCase() });
                    let token = await Modules.Auth.createToken(ctx, user.id!);
                    response.json({ ok: true, accessToken: token.salt });
                    authSession.enabled = false;
                    return;
                }
            } else {
                sendError(response, 'server_error');
            }
        });
    });
}
