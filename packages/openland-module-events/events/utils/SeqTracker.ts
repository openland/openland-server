export type SeqTracker = {
    readonly validated: { readonly seq: number, readonly state: Buffer },
    readonly maxSeq: number,
    readonly pending: Record<number, Buffer>
};

export function seqTrackerCreate(seq: number, state: Buffer): SeqTracker {
    return Object.freeze({
        validated: Object.freeze({ seq, state }),
        maxSeq: seq,
        pending: Object.freeze({})
    });
}

export function seqTrackerReceive(src: SeqTracker, seq: number, state: Buffer): { handle: boolean, state: SeqTracker } {
    if (seq <= src.validated.seq) {
        return {
            handle: false,
            state: src
        };
    }

    let maxSeq = Math.max(seq, src.maxSeq);
    let validated: { readonly seq: number, state: Buffer } = src.validated;
    let pending: Record<number, Buffer> = { ...src.pending };

    if (validated.seq === seq - 1) {
        validated = { seq, state };

        while (Object.keys(pending).length > 0) {
            let st = pending[validated.seq + 1];
            if (st) {
                delete pending[validated.seq + 1];
                validated = { seq: validated.seq + 1, state: st };
            } else {
                break;
            }
        }
    } else {
        if (pending[seq]) {
            return {
                handle: false,
                state: src
            };
        } else {
            pending[seq] = state;
        }
    }

    return {
        handle: true,
        state: Object.freeze({
            validated: Object.freeze(validated),
            pending: Object.freeze(pending),
            maxSeq
        })
    };
}