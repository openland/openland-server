import { multiLang, templated } from './util';

export const Notifications = {
    NEW_MESSAGE_ANONYMOUS: multiLang({
        EN: 'New message',
        RU: 'Новое сообщение'
    }),
    IMAGE_ATTACH: multiLang({
        EN: 'Photo',
        RU: 'Изображение'
    }),
    VIDEO_ATTACH: multiLang({
        EN: 'Video',
        RU: 'Видео'
    }),
    GIF_ATTACH: multiLang({
        EN: 'GIF',
        RU: 'Анимация'
    }),
    DOCUMENT_ATTACH: multiLang({
        EN: 'Document',
        RU: 'Документ'
    }),
    REPLY_ATTACH: multiLang({
        EN: 'Forward',
        RU: 'Ответ'
    }),
    STICKER: multiLang({
        EN: 'Sticker',
        RU: 'Стикер'
    }),
    DONATION_ATTACH: multiLang({
        EN: 'Donation',
        RU: 'Пожертвование'
    }),
    GROUP_PUSH_TITLE: templated<{ senderName: string, chatTitle: string }>('{{senderName}}@{{chatTitle}}')
};