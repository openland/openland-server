export interface SSpan {
    setTag(key: string, value: any): void;
    finish(): void;
}