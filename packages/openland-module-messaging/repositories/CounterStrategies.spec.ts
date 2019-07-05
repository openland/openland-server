import {
    AllUnreadMessagesCalculator,
} from './CounterStrategies';

describe('CounterStrategies', () => {
    it('AllUnreadMessagesCalculator should correctly calculate counter', async () => {
        expect(AllUnreadMessagesCalculator.onMessageReceived(0, false)).toBe(1);
        expect(AllUnreadMessagesCalculator.onMessageRead(1, false, 1)).toBe(-1);
        expect(AllUnreadMessagesCalculator.onMessageDeleted(100, false)).toBe(-1);
        expect(AllUnreadMessagesCalculator.onChatDeleted(100, false)).toBe(-100);
    });
});