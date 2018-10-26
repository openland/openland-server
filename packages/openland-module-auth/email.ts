import express from 'express';
import { randomNumbersString } from '../openland-server/utils/random';
import { Emails } from '../openland-server/services/Emails';
import { DB } from '../openland-server/tables';
import * as base64 from '../openland-server/utils/base64';
import { randomBytes } from 'crypto';
import { Modules } from 'openland-modules/Modules';
import { inTx } from 'foundation-orm/inTx';
import { AuthCodeSession } from 'openland-module-db/schema';

const ERROR_TEXT = {
    0: 'Wrong arguments passed',
    1: 'Server error',
    2: 'Session not found',
    3: 'Code expired',
    4: 'Wrong code',
    5: 'No email or phone passed',
    6: 'No session passed',
    7: 'No code passed',
    8: 'No authToken passed'
};

const sendError = (response: express.Response, code: number) => {
    response.json({ ok: false, errorCode: code, errorText: (ERROR_TEXT as any)[code] });
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

    let res = await inTx(async () => {
        let authSession: AuthCodeSession | undefined;
        if (session) {
            let existing = await Modules.Auth.repo.findSession(session);
            if (!existing) {
                sendError(response, 2);
                return undefined;
            }
            authSession = existing;
        }

        if (!email && !phone) {
            sendError(response, 5);
            return undefined;
        }

        let code = randomNumbersString(5);

        if (email) {
            email = (email as string).toLowerCase();
            let isTest = isTestEmail(email);

            if (!isTest) {
                await Emails.sendActivationCodeEmail(email, code);
            } else {
                code = testEmailCode(email);
            }

            if (!authSession) {
                authSession = await Modules.Auth.repo.createSession(email, code);
            } else {
                authSession.code = code;
            }
            return authSession;
        } else {
            sendError(response, 5);
        }
        return undefined;
    });

    if (res) {
        response.json({ ok: true, session: res!.uid });
    } else {
        sendError(response, 5);
    }
    // return await DB.txLight(async (tx) => {
    //     let {
    //         email,
    //         phone,
    //         session
    //     } = req.body;

    //     console.log('auth_sendCode', JSON.stringify(req.body));

    //     let authSession: AuthSession;

    //     if (session) {
    //         let existing = await DB.AuthSession.findOne({ where: { sessionSalt: session }, transaction: tx });

    //         // No session found
    //         if (!existing) {
    //             sendError(response, 2);
    //             return;
    //         }
    //         authSession = existing;
    //     }

    //     if (!email && !phone) {
    //         sendError(response, 5);
    //         return;
    //     }

    //     let code = randomNumbersString(5);

    //     if (email) {
    //         email = (email as string).toLowerCase();
    //         let isTest = isTestEmail(email);

    //         if (!isTest) {
    //             await Emails.sendActivationCodeEmail(email, code, tx);
    //         } else {
    //             code = testEmailCode(email);
    //         }

    //         if (!authSession!) {
    //             authSession = await DB.AuthSession.create({
    //                 sessionSalt: base64.encodeBuffer(randomBytes(64)),
    //                 code,
    //                 codeExpires: new Date(Date.now() + 1000 * 60 * 5), // 5 minutes
    //                 extras: {
    //                     email
    //                 }
    //             }, { transaction: tx });
    //         } else {
    //             await authSession!.update({ code });
    //         }

    //         response.json({ ok: true, session: authSession!.sessionSalt });
    //     }
    // });
}

export async function checkCode(req: express.Request, response: express.Response) {

    let {
        session,
        code
    } = req.body;

    if (!session) {
        sendError(response, 6);
        return;
    }
    if (!code) {
        sendError(response, 7);
        return;
    }

    let res = await inTx(async () => {
        let authSession = await Modules.Auth.repo.findSession(session);

        // No session found
        if (!authSession) {
            sendError(response, 2);
            return;
        }

        // Code expired
        if (Date.now() > authSession.expires) {
            sendError(response, 3);
            return;
        }

        // Wrong code
        if (authSession.code! !== code) {
            sendError(response, 4);
            return;
        }

        authSession.tokenId = base64.encodeBuffer(randomBytes(64));

        return authSession;
    });

    response.json({ ok: true, authToken: res!.tokenId });
}

export async function getAccessToken(req: express.Request, response: express.Response) {
    return await DB.txLight(async (tx) => {
        let {
            session,
            authToken
        } = req.body;

        if (!session) {
            sendError(response, 6);
            return;
        }
        if (!authToken) {
            sendError(response, 8);
            return;
        }

        await inTx(async () => {
            let authSession = await Modules.Auth.repo.findSession(session);

            // No session found
            if (!authSession) {
                sendError(response, 2);
                return;
            }

            if (authSession.email) {
                let sequelize = DB.connection;

                let existing = await DB.User.findOne({
                    where: [
                        sequelize.or(
                            {
                                email: authSession.email as any
                            },
                            {
                                authId: 'email|' + authSession.email as any
                            }

                        )],
                    order: [['createdAt', 'ASC']],
                    transaction: tx,
                    lock: tx.LOCK.UPDATE
                });

                if (existing) {
                    let token = await Modules.Auth.createToken(existing.id!);
                    response.json({ ok: true, accessToken: token });
                    authSession.enabled = false;
                    return;
                } else {
                    let user = await DB.User.create({
                        authId: 'email|' + authSession.email,
                        email: authSession.email as string,
                    }, { transaction: tx });
                    let token = await Modules.Auth.createToken(user.id!);
                    response.json({ ok: true, accessToken: token });
                    authSession.enabled = false;
                    return;
                }
            } else {
                sendError(response, 1);
            }
        });
    });
}