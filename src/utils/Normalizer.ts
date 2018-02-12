export class Normalizer {
    normalizeId(id: string) {
        return id.replace(/^0+/, '');
    }
}