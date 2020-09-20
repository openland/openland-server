import { seqTrackerCreate, seqTrackerReceive } from './SeqTracker';
import { encoders } from '@openland/foundationdb';

function createEvent(id: number) {
    return encoders.int32BE.pack(id);
}

describe('SeqTracker', () => {
    it('should handle consequent seq numbers', () => {
        let tracker = seqTrackerCreate(1, createEvent(1));

        let updated = seqTrackerReceive(tracker, 2, createEvent(2));
        tracker = updated.state;
        expect(updated.handle).toBe(true);

        updated = seqTrackerReceive(tracker, 3, createEvent(3));
        tracker = updated.state;
        expect(updated.handle).toBe(true);

        updated = seqTrackerReceive(tracker, 4, createEvent(4));
        tracker = updated.state;
        expect(updated.handle).toBe(true);

        updated = seqTrackerReceive(tracker, 5, createEvent(5));
        tracker = updated.state;
        expect(updated.handle).toBe(true);

        expect(tracker.maxSeq).toBe(5);
        expect(tracker.validated.seq).toBe(5);
        expect(tracker.validated.state).toMatchObject(createEvent(5));

        updated = seqTrackerReceive(tracker, 5, createEvent(5));
        tracker = updated.state;
        expect(updated.handle).toBe(false);

        updated = seqTrackerReceive(tracker, 1, createEvent(5));
        tracker = updated.state;
        expect(updated.handle).toBe(false);
    });

    it('should make holes and recover from them', () => {
        let tracker = seqTrackerCreate(1, createEvent(1));

        let updated = seqTrackerReceive(tracker, 3, createEvent(3));
        tracker = updated.state;
        expect(updated.handle).toBe(true);
        expect(tracker.maxSeq).toBe(3);
        expect(tracker.validated.seq).toBe(1);
        expect(tracker.validated.state).toMatchObject(createEvent(1));

        updated = seqTrackerReceive(tracker, 4, createEvent(4));
        tracker = updated.state;
        expect(updated.handle).toBe(true);
        expect(tracker.maxSeq).toBe(4);
        expect(tracker.validated.seq).toBe(1);
        expect(tracker.validated.state).toMatchObject(createEvent(1));

        updated = seqTrackerReceive(tracker, 6, createEvent(6));
        tracker = updated.state;
        expect(updated.handle).toBe(true);
        expect(tracker.maxSeq).toBe(6);
        expect(tracker.validated.seq).toBe(1);
        expect(tracker.validated.state).toMatchObject(createEvent(1));

        updated = seqTrackerReceive(tracker, 2, createEvent(2));
        tracker = updated.state;
        expect(updated.handle).toBe(true);
        expect(tracker.maxSeq).toBe(6);
        expect(tracker.validated.seq).toBe(4);
        expect(tracker.validated.state).toMatchObject(createEvent(4));

        updated = seqTrackerReceive(tracker, 5, createEvent(5));
        tracker = updated.state;
        expect(updated.handle).toBe(true);
        expect(tracker.maxSeq).toBe(6);
        expect(tracker.validated.seq).toBe(6);
        expect(tracker.validated.state).toMatchObject(createEvent(6));       
    });
});