import { ImageRef } from '../repositories/Media';

export const Sanitizer = {
    sanitizeString(str: string | null | undefined): string | null {
        if (str !== null && str !== undefined) {
            str = str.trim();
            if (str.length > 0) {
                return str;
            }
        }
        return null;
    },
    sanitizeImageRef(src: ImageRef | null | undefined): ImageRef | null {
        if (src !== null && src !== undefined) {
            return {
                uuid: src.uuid,
                crop: src.crop ? {
                    x: src.crop.x,
                    y: src.crop.y,
                    w: src.crop.w,
                    h: src.crop.h
                } : null
            };
        }
        return null;
    }
};