export interface TypingEvent {
    forUserId: number;
    userId: number;
    conversationId: number;
    type: string;
    cancel: boolean;
}