import { templated } from './util';

export const Notifications = {
    NEW_MESSAGE_ANONYMOUS: 'New message',
    FILE_ATTACH: '<file>',
    IMAGE_ATTACH: '🏞 Photo',
    VIDEO_ATTACH: '🎬 Video',
    GIF_ATTACH: '🎥 GIF',
    DOCUMENT_ATTACH: '📎 Document',
    GROUP_PUSH_TITLE: templated<{senderName: string, chatTitle: string}>('{{senderName}}@{{chatTitle}}')
};