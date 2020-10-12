export interface EventSerializer<T> {
    parseEvent(src: Buffer): T;
    serializeEvent(src: T): Buffer;
}