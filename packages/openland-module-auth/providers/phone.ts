import express, { Express } from 'express';
import * as bodyParser from 'body-parser';
import { createPersistenceThrottle } from '../../openland-utils/PersistenceThrottle';
import { createNamedContext } from '@openland/context';
import { inTx } from '@openland/foundationdb';
import { SmsService } from '../../openland-utils/sms/SmsService';
import { createOneTimeCodeGenerator } from '../../openland-utils/OneTimeCode';
import { Store } from '../../openland-module-db/FDB';
import * as base64 from '../../openland-utils/base64';
import { randomBytes } from 'crypto';
import { Modules } from '../../openland-modules/Modules';
import { createLogger } from '@openland/log';
import { doSimpleHash } from '../../openland-module-push/workers/PushWorker';
import { IDs } from '../../openland-module-api/IDs';
import { createTracer } from 'openland-log/createTracer';
import { BlockedPrefixes } from 'openland-module-auth/blacklist';

const tracer = createTracer('phone-auth');
const logger = createLogger('phone-auth');

const Errors = {
    wrong_arg: 'An unexpected error occurred. Please try again.',
    server_error: 'An unexpected error occurred. Please try again.',
    session_not_found: 'An unexpected error occurred. Please try again.',
    code_expired: 'This code has expired. Please click Resend and we\'ll send you a new message.',
    wrong_code: 'Wrong code',
    no_email_or_phone: 'Please enter your phone number',
    no_session: 'An unexpected error occurred. Please try again.',
    no_code: 'Please enter the 6-digit code we\'ve just sent to your email',
    no_auth_token: 'An unexpected error occurred. Please try again.',
    invalid_email: 'It looks like this email is incorrect. Please check your email address and try again.',
    invalid_auth_token: 'An unexpected error occurred. Please try again.',
    session_expired: 'An unexpected error occurred. Please try again.',
    wrong_code_length: 'Wrong code',
    too_many_attempts: 'Too many requests. Try again later',
    wrong_phone: 'Invalid phone number'
};

type ErrorsEnum = keyof typeof Errors;

class HttpError extends Error {
    readonly code: ErrorsEnum;
    readonly extra: any;

    constructor(code: ErrorsEnum, extra: any = undefined) {
        super(code);
        this.code = code;
        this.extra = extra;
    }
}

const CodeLength = 6;
const phoneThrottle = createPersistenceThrottle('auth_phone');
const phoneCode = createOneTimeCodeGenerator<{ phone: string, authToken: string }>('email_change', 60 * 5, 5, CodeLength);
const rootCtx = createNamedContext('auth-phone');
const log = createLogger('auth-phone');
const phoneRegexp = /^\+[1-9]{1}[0-9]{3,14}$/;

function httpHandler(handler: (req: express.Request) => Promise<any>) {
    return async (req: express.Request, response: express.Response) => {
        try {
            let res = await handler(req);
            if (res) {
                response.json(res);
                return;
            } else {
                response.json({ ok: false, errorCode: 'server_error', errorText: Errors.server_error });
                return;
            }
        } catch (e) {
            log.log(rootCtx, 'error', e);
            if (e instanceof HttpError) {
                if (!Errors[e.code]) {
                    response.json({ ok: false, errorCode: 'server_error', errorText: Errors.server_error });
                    return;
                }
                response.json({ ok: false, errorCode: e.code, errorText: Errors[e.code], ...e.extra });
                return;
            } else {
                response.json({ ok: false, errorCode: 'server_error', errorText: Errors.server_error });
                return;
            }
        }
    };
}

export function initPhoneAuthProvider(app: Express) {
    app.post('/auth/phone/sendCode', bodyParser.json(), httpHandler(async req => {
        return await tracer.trace(rootCtx, 'send-code', async (parent) => {
            if (!req.body.phone || typeof req.body.phone !== 'string') {
                throw new HttpError('wrong_arg');
            }
            const phone = (req.body.phone as string).trim();
            if (!phoneRegexp.test(phone)) {
                throw new HttpError('wrong_arg');
            }

            const blocked = (await inTx(parent, async (ctx) => {
                let locked = (await Modules.Super.getEnvVar<string>(ctx, 'phones.blocked'));
                if (!locked) {
                    return BlockedPrefixes;
                }
                return locked.split(',');
            }));
            logger.log(parent, 'Loaded blocked phones: ' + JSON.stringify(blocked));

            for (let p of blocked) {
                if (phone.startsWith(p)) {
                    throw new HttpError('wrong_arg');
                }
            }
            logger.log(parent, 'Code auth attempt for ' + phone + ' at ' + req.ips.join(',') + ' ' + JSON.stringify(req.headers));

            let code = await inTx(parent, async (ctx) => {
                // Handle throttle
                let nextEmailTime = await phoneThrottle.nextFireTimeout(ctx, phone);
                if (nextEmailTime > 0) {
                    throw new HttpError('too_many_attempts', { can_send_next_email_at: nextEmailTime });
                }

                // Fire throttler
                await phoneThrottle.onFire(ctx, phone);

                // Create one time code
                return await phoneCode.create(ctx, { phone, authToken: base64.encodeBuffer(randomBytes(64)) });
            });

            // Send code
            try {
                await SmsService.sendSms(parent, phone, `Openland code: ${code.code}. Valid for 5 minutes.`);
            } catch (e) {
                if (e.code && e.code === 21211) {
                    throw new HttpError('wrong_phone');
                } else {
                    throw e;
                }
            }

            // Resolve profile
            return await inTx(parent, async (ctx) => {
                let existingUser = await Store.User.fromPhone.find(ctx, phone);
                if (existingUser) {
                    let profile = await Store.UserProfile.findById(ctx, existingUser.id);
                    return {
                        ok: true,
                        session: code.id,
                        profileExists: !!profile,
                        pictureId: profile && profile.picture && profile.picture.uuid,
                        pictureHash: profile ? doSimpleHash(IDs.User.serialize(profile.id)) : null,
                        pictureCrop: profile && profile.picture && profile.picture.crop,
                        initials: profile ? ((profile.firstName || '').slice(0, 1) + ' ' + (profile.lastName || '').slice(0, 1)).toUpperCase() : null
                    };
                } else {
                    return {
                        ok: true,
                        session: code.id
                    };
                }
            });
        });
    }));
    app.post('/auth/phone/checkCode', bodyParser.json(), httpHandler(async req => {
        return await tracer.trace(rootCtx, 'check-code', async (parent) => {
            let {
                session,
                code
            } = req.body;

            if (!session || !code || typeof session !== 'string' || typeof code !== 'string') {
                throw new HttpError('wrong_arg');
            }
            // Store use attempt
            await inTx(parent, async (ctx) => {
                await phoneCode.onUseAttempt(ctx, session);
            });

            return await inTx(parent, async (ctx) => {
                session = session.trim();
                code = code.trim();

                let authCode = await phoneCode.findById(ctx, session);

                if (!authCode) {
                    if (await phoneCode.isExpired(ctx, session)) {
                        throw new HttpError('code_expired');
                    }
                    throw new HttpError('session_not_found');
                }

                if (authCode.code !== code) {
                    throw new HttpError('wrong_code');
                }

                return { ok: true, authToken: authCode.data.authToken };
            });
        });
    }));
    app.post('/auth/phone/getAccessToken', bodyParser.json(), httpHandler(async req => {
        return await tracer.trace(rootCtx, 'get-token', async (parent) => {
            let {
                session,
                authToken
            } = req.body;

            if (!session || !authToken || typeof session !== 'string' || typeof authToken !== 'string') {
                throw new HttpError('wrong_arg');
            }

            return await inTx(parent, async (ctx) => {
                let authCode = await phoneCode.findById(ctx, session);
                if (!authCode) {
                    throw new HttpError('session_not_found');
                }

                if (authCode.data.authToken !== authToken) {
                    throw new HttpError('invalid_auth_token');
                }
                let phone = authCode.data.phone;

                // Release throttle
                await phoneThrottle.release(ctx, phone);
                // Mark code used
                // await phoneCode.onUse(ctx, authCode.code);

                let existingUser = await Store.User.fromPhone.find(ctx, phone);

                if (existingUser) {
                    let token = await Modules.Auth.createToken(ctx, existingUser.id);
                    return { ok: true, accessToken: token.salt };
                } else {
                    let user = await Modules.Users.createUser(ctx, { phone });
                    let token = await Modules.Auth.createToken(ctx, user.id);
                    return { ok: true, accessToken: token.salt };
                }
            });
        });
    }));
}
