import { ImageRef } from 'openland-module-media/ImageRef';

export const Sanitizer = {
    sanitizeAny<T>(src: T | null | undefined): T | null {
        if (src !== null && src !== undefined) {
            return src;
        }
        return null;
    },
    sanitizeString(str: string | null | undefined): string | null {
        if (str !== null && str !== undefined) {
            str = str.trim();
            if (str.length > 0) {
                return str;
            }
        }
        return null;
    },
    sanitizeNumber(num: number | null | undefined): number | null {
        if (num !== null && num !== undefined) {
            return num;
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