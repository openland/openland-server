import { Express } from 'express';
import express from 'express';
import { inTx } from '../foundation-orm/inTx';
import { createEmptyContext } from '../openland-utils/Context';
import { Modules } from '../openland-modules/Modules';
import * as bodyParser from 'body-parser';
import { jBool, jField, json, JsonSchema, jString, validateJson } from '../openland-utils/jsonSchema';
// import { jField, json, jString } from '../openland-utils/jsonSchema';

const Errors = {
    hook_key_missing: { code: 0, text: 'Hook key is missing' },
    hook_not_found: { code: 1, text: 'Hook not found' },
    message_missing: { code: 2, text: 'Message missing' },
};

const sendError = (response: express.Response, error: { code: number, text: string }) => {
    response.json({ ok: false, errorCode: error.code, errorText: error.text });
};

let parent = createEmptyContext();

export function initAppHandlers(app: Express) {
    app.post('/apps/chat-hook/:hookKey', bodyParser.json(), handleChatHook);
}

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
        jField('ignoreLinkDetection', jBool(), true);
        jField('repeatKey', jString(), true);
    }),
    async (req: express.Request, response: express.Response) => {
        return await inTx(parent, async (ctx) => {
            let {hookKey} = req.params;

            if (!hookKey) {
                sendError(response, Errors.hook_key_missing);
                return;
            }

            let hook = await Modules.DB.entities.AppHook.findFromKey(ctx, hookKey);

            if (!hook) {
                sendError(response, Errors.hook_not_found);
                return;
            }

            let {
                message,
                ignoreLinkDetection,
                repeatKey
            } = req.body;

            let ignoreAugmentation = ignoreLinkDetection !== undefined ? ignoreLinkDetection : true;

            await Modules.Messaging.sendMessage(ctx, hook.chatId, hook.appId, { message, ignoreAugmentation, repeatKey });

            response.send({ ok: true });
        });
    }
);
