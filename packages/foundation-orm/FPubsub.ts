export type FPubsubSubcription = { cancel(): void };

export interface FPubsub {
    publish(topic: string, data: any): void;
    subscribe(topic: string, receiver: (data: any) => void): FPubsubSubcription;
}