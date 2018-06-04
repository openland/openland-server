export interface ImageCrop {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface ImageRef {
    uuid: string;
    crop?: ImageCrop | null;
}

export function buildBaseImageUrl(image: ImageRef) {
    let res = 'https://ucarecdn.com/' + image.uuid + '/';
    if (image.crop) {
        res += `-/crop/${image.crop.w}x${image.crop.h}/${image.crop.x},${image.crop.y}/`;
    }
    return res;
}