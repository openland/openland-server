import { templated } from './util';

const RespondKeyboard = [[ { title: 'Respond', style: 'DEFAULT', id: 'RESPOND' } ]];
const ApplyKeyboard = [[ { title: 'Apply', style: 'DEFAULT', id: 'APPLY' } ]];
const ApplyRecommendKeyboard = [[ { title: 'Apply', style: 'DEFAULT', id: 'APPLY' }, { title: 'Recommend', style: 'LIGHT', id: 'RECOMMEND' } ]];

export type PostTextTemplate = (vars: PostTemplateInterface) => string;

type PostTemplateInterface = {
    post_author: string;
    responder: string;
    chat: string;
    post_title: string;
    post_author_name: string;
    responder_name: string;
};

export const PostTemplates = {
    BLANK: {
        buttons: RespondKeyboard,
        RESPOND_TEXT: templated<PostTemplateInterface>('🙌 {{post_author}} — {{responder}} is responding to your post “{{post_title}}” in {{chat}}.\nNow you can chat!'),
    },
    JOB_OPPORTUNITY: {
        buttons: ApplyRecommendKeyboard,
        APPLY_TEXT: templated<PostTemplateInterface>('🙌 {{post_author}} — {{responder}} is interested in your job opportunity “{{post_title}}” in {{chat}}.\n{{responder_name}} — as the next step, please, tell {{post_author_name}} a little bit about yourself.'),
        RECOMMEND_TEXT: templated<PostTemplateInterface>('🙌  {{post_author}} — {{responder}} is looking to recommend a startup in response to your post “{{post_title}}” in {{chat}}.\n{{responder_name}} — as the next step, please, describe a startup, tell how well you know the founders, and express the strength of your recommendation'),
    },
    OFFICE_HOURS: {
        buttons: ApplyKeyboard,
        APPLY_TEXT: templated<PostTemplateInterface>('🙌  {{post_author}} — {{responder}} is responding to your post “{{post_title}}” in {{chat}}.'),
    },
    REQUEST_FOR_STARTUPS: {
        buttons: ApplyRecommendKeyboard,
        APPLY_TEXT: templated<PostTemplateInterface>('🙌  {{Post author Full name}} — {{Responder Full name}} is responding to your post “{{Post title}}” in {{Chat name+link}}.'),
        RECOMMEND_TEXT: templated<PostTemplateInterface>('🙌  {{Post author Full name}} — {{Responder Full name}} is responding to your post “{{Post title}}” in {{Chat name+link}}.'),
    }
};