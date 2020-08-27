import { SeqTracker } from './SeqTracker';
import { encoders } from '@openland/foundationdb';

function createEvent(id: number) {
    return encoders.int32BE.pack(id);
}

describe('SeqTracker', () => {
    it('should handle consequent seq numbers', () => {
        let tracker = new SeqTracker(1, createEvent(1));
        expect(tracker.seqReceived(2, createEvent(2))).toBe(true);
        expect(tracker.seqReceived(3, createEvent(3))).toBe(true);
        expect(tracker.seqReceived(4, createEvent(4))).toBe(true);
        expect(tracker.seqReceived(5, createEvent(5))).toBe(true);
        expect(tracker.maxReceivedSeq).toBe(5);
        expect(tracker.validatedSeq).toBe(5);
        expect(tracker.validatedState).toMatchObject(createEvent(5));
        expect(tracker.seqReceived(5, createEvent(5))).toBe(false);
        expect(tracker.seqReceived(1, createEvent(1))).toBe(false);
    });

    it('should make holes and recover from them', () => {
        let tracker = new SeqTracker(1, createEvent(1));

        expect(tracker.seqReceived(3, createEvent(3))).toBe(true);
        expect(tracker.maxReceivedSeq).toBe(3);
        expect(tracker.validatedSeq).toBe(1);
        expect(tracker.validatedState).toMatchObject(createEvent(1));

        expect(tracker.seqReceived(4, createEvent(4))).toBe(true);
        expect(tracker.maxReceivedSeq).toBe(4);
        expect(tracker.validatedSeq).toBe(1);
        expect(tracker.validatedState).toMatchObject(createEvent(1));

        expect(tracker.seqReceived(6, createEvent(6))).toBe(true);
        expect(tracker.maxReceivedSeq).toBe(6);
        expect(tracker.validatedSeq).toBe(1);
        expect(tracker.validatedState).toMatchObject(createEvent(1));

        expect(tracker.seqReceived(2, createEvent(2))).toBe(true);
        expect(tracker.maxReceivedSeq).toBe(6);
        expect(tracker.validatedSeq).toBe(4);
        expect(tracker.validatedState).toMatchObject(createEvent(4));

        expect(tracker.seqReceived(5, createEvent(5))).toBe(true);
        expect(tracker.maxReceivedSeq).toBe(6);
        expect(tracker.validatedSeq).toBe(6);
        expect(tracker.validatedState).toMatchObject(createEvent(6));
    });

    it('should make handle restoring sequence', () => {
        let tracker = new SeqTracker(1, createEvent(1));

        // Add #3
        expect(tracker.seqReceived(3, createEvent(3))).toBe(true);
        expect(tracker.maxReceivedSeq).toBe(3);
        expect(tracker.validatedSeq).toBe(1);
        expect(tracker.validatedState).toMatchObject(createEvent(1));

        // Add #5
        expect(tracker.seqReceived(5, createEvent(5))).toBe(true);
        expect(tracker.maxReceivedSeq).toBe(5);
        expect(tracker.validatedSeq).toBe(1);
        expect(tracker.validatedState).toMatchObject(createEvent(1));

        // Restore sequence up to #3
        tracker.sequenceRestored(3, createEvent(3));
        expect(tracker.maxReceivedSeq).toBe(5);
        expect(tracker.validatedSeq).toBe(3);
        expect(tracker.validatedState).toMatchObject(createEvent(3));

        // Restore sequence up to #4 - should validate up to 5
        tracker.sequenceRestored(4, createEvent(4));
        expect(tracker.maxReceivedSeq).toBe(5);
        expect(tracker.validatedSeq).toBe(5);
        expect(tracker.validatedState).toMatchObject(createEvent(5));
    });
});