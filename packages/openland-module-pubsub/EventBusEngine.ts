export declare type EventBusEngineSubcription = {
    cancel(): void;
};

export interface EventBusEngine {
    publish(topic: string, data: any): void;
    subscribe(topic: string, receiver: (data: any) => void): EventBusEngineSubcription;
}