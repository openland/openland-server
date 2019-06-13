export interface FWatch {
    promise: Promise<boolean>;
    cancel(): void;
}