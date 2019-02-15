export interface ImageCrop {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface ImageRef {
    uuid: string;
    crop: ImageCrop | null;
}

export function buildBaseImageUrl(image?: ImageRef | null) {
    if (image) {
        let res = 'https://ucarecdn.com/' + image.uuid + '/';
        if (image.crop) {
            res += `-/crop/${image.crop.w}x${image.crop.h}/${image.crop.x},${image.crop.y}/`;
        }
        return res;
    } else {
        return null;
    }
}

export function imageCropEquals(crop1: ImageCrop, crop2: ImageCrop) {
    return crop1.h === crop2.h &&
        crop1.w === crop2.w &&
        crop1.x === crop2.x &&
        crop1.y === crop2.y;
}

export function imageRefEquals(ref1: ImageRef | null, ref2: ImageRef | null) {
    if (ref1 === null && ref2 === null) {
        return true;
    } else if (ref1 === null || ref2 === null) {
        return false;
    }

    return (
        ref1.uuid === ref2.uuid &&
        (ref1.crop && ref2.crop ? imageCropEquals(ref1.crop, ref2.crop) : (ref1.crop === ref2.crop))
    );
}