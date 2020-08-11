import imurmurhash from 'imurmurhash';

export function murmurhash(src: string) {
    let hash = imurmurhash();
    hash.hash(src);
    return hash.result();
}