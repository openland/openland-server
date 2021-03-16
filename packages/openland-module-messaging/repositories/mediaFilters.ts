import { MessageShape } from '../../openland-module-db/store';

export const hasImageAttachment = (item: MessageShape) => {
    if (item.deleted) {
        return false;
    }

    if (item.fileId) {
        if (item.fileMetadata && item.fileMetadata.isImage) {
            return true;
        }
    }
    if (item.attachments) {
        for (let attach of item.attachments) {
            if (attach.fileMetadata && attach.fileMetadata.isImage) {
                return true;
            }
        }
    }
    if (item.attachmentsModern) {
        for (let attach of item.attachmentsModern) {
            if (attach.type === 'file_attachment') {
                if (attach.fileMetadata && attach.fileMetadata.isImage) {
                    return true;
                }
            }
        }
    }
    return false;
};

export const hasLinkAttachment = (item: MessageShape) => {
    if (item.deleted) {
        return false;
    }

    if (item.augmentation) {
        return true;
    }

    if (item.attachmentsModern) {
        for (let attach of item.attachmentsModern) {
            if (attach.type === 'rich_attachment') {
                return true;
            }
        }
    }
    return false;
};

export const hasVideoAttachment = (item: MessageShape) => {
    if (item.deleted) {
        return false;
    }

    if (item.fileId && item.fileMetadata && item.fileMetadata.mimeType.startsWith('video/')) {
        return true;
    }
    if (item.attachments) {
        for (let attach of item.attachments) {
            if (attach.fileMetadata && attach.fileMetadata.mimeType.startsWith('video/')) {
                return true;
            }
        }
    }
    if (item.attachmentsModern) {
        for (let attach of item.attachmentsModern) {
            if (attach.type === 'file_attachment' && attach.fileMetadata && attach.fileMetadata.mimeType.startsWith('video/')) {
                return true;
            }
        }
    }
    return false;
};

export const hasDocumentAttachment = (item: MessageShape) => {
    if (item.deleted) {
        return false;
    }

    if (item.fileId) {
        if (item.fileMetadata && !item.fileMetadata.isImage && !item.fileMetadata.mimeType.startsWith('video/')) {
            return true;
        }
    }
    if (item.attachments) {
        for (let attach of item.attachments) {
            if (attach.fileMetadata && !attach.fileMetadata.isImage && !attach.fileMetadata.mimeType.startsWith('video/')) {
                return true;
            }
        }
    }
    if (item.attachmentsModern) {
        for (let attach of item.attachmentsModern) {
            if (attach.type === 'file_attachment') {
                if (attach.fileMetadata && !attach.fileMetadata.isImage && !attach.fileMetadata.mimeType.startsWith('video/')) {
                    return true;
                }
            }
        }
    }
    return false;
};