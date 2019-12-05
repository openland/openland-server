import { inTx } from '@openland/foundationdb';
import { Express } from 'express';
import express from 'express';
import { Modules } from '../openland-modules/Modules';
import * as bodyParser from 'body-parser';
import { jBool, jField, json, JsonSchema, jString, validateJson, jVec } from '../openland-utils/jsonSchema';
import { createNamedContext } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
// import { jField, json, jString } from '../openland-utils/jsonSchema';

const Errors = {
    hook_key_missing: { code: 0, text: 'Hook key is missing' },
    hook_not_found: { code: 1, text: 'Hook not found' },
    message_missing: { code: 2, text: 'Message missing' },
};

const sendError = (response: express.Response, error: { code: number, text: string }) => {
    response.json({ ok: false, errorCode: error.code, errorText: error.text });
};

let parent = createNamedContext('apps');

function handler(schema: JsonSchema, h: (req: express.Request, response: express.Response) => any) {
    return (req: express.Request, response: express.Response) => {
        try {
            validateJson(schema, req.body);
        } catch (e) {
            sendError(response, { code: 7, text: e.message });
            return;
        }

        h(req, response);
    };
}

const handleChatHook = handler(
    json(() => {
        jField('message', jString());
        jField('ignoreLinkDetection', jBool()).undefinable();
        jField('imageAttachments', jVec(jString())).undefinable();
        jField('repeatKey', jString()).undefinable();
    }),
    async (req: express.Request, response: express.Response) => {
        return await inTx(parent, async (ctx) => {
            let {hookKey} = req.params;

            if (!hookKey) {
                sendError(response, Errors.hook_key_missing);
                return;
            }

            let hook = await Store.AppHook.key.find(ctx, hookKey);

            if (!hook) {
                sendError(response, Errors.hook_not_found);
                return;
            }

            let {
                message,
                ignoreLinkDetection,
                repeatKey,
                fileAttachments
            } = req.body;

            let ignoreAugmentation = ignoreLinkDetection !== undefined ? ignoreLinkDetection : true;

            if (fileAttachments) {
                await Promise.all(fileAttachments.map((a: string) => Modules.Media.saveFile(ctx, a)));
            }

            await Modules.Messaging.sendMessage(ctx, hook.chatId, hook.appId, {
                message,
                ignoreAugmentation,
                repeatKey,
                attachments: fileAttachments ? fileAttachments.map((a: string) => ({
                    image: {
                        uuid: a
                    }
                })) : []
            });

            response.send({ ok: true });
        });
    }
);

export function initAppHandlers(app: Express) {
    app.post('/apps/chat-hook/:hookKey', bodyParser.json(), handleChatHook);
}