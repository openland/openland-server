import { templated } from './util';

const RespondKeyboard = [[ { title: 'Respond', style: 'DEFAULT', id: 'RESPOND' } ]];

export type PostTextTemplate = (vars: PostTemplateInterface) => string;

type PostTemplateInterface = {
    post_author: string;
    responder: string;
    chat: string;
    post_title: string;
};

export const PostTemplates = {
    BLANK: {
        buttons: RespondKeyboard,
        RESPOND_TEXT: templated<PostTemplateInterface>('🙌 {{post_author}} — {{responder}} is responding to your post “{{post_title}}” in {{chat}}. Now you can chat!')
    }
};