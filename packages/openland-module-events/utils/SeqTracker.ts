export class SeqTracker {
    private _validatedSeq: number;
    private _validatedState: Buffer;
    private _maxReceivedSeq: number;
    private _pendingSeq = new Map<number, Buffer>();

    constructor(seq: number, state: Buffer) {
        this._validatedSeq = seq;
        this._validatedState = state;
        this._maxReceivedSeq = seq;
    }

    get validatedSeq() {
        return this._validatedSeq;
    }

    get validatedState() {
        return this._validatedState;
    }

    get maxReceivedSeq() {
        return this._maxReceivedSeq;
    }

    seqReceived = (seq: number, state: Buffer): boolean => {

        // Handle basic
        if (seq <= this._validatedSeq) {
            return false; // Too Old
        }
        this._maxReceivedSeq = Math.max(seq, this._maxReceivedSeq);

        if (this._validatedSeq === seq - 1) {
            this._validatedSeq = seq;
            this._validatedState = state;
            while (this._pendingSeq.size > 0) {
                if (this._pendingSeq.has(this._validatedSeq + 1)) {
                    let st = this._pendingSeq.get(this._validatedSeq + 1)!;
                    this._pendingSeq.delete(this._validatedSeq + 1);
                    this._validatedSeq++;
                    this._validatedState = st;
                } else {
                    break;
                }
            }
        } else {
            if (this._pendingSeq.has(seq)) {
                return false; // Already received
            } else {
                this._pendingSeq.set(seq, state);
            }
        }
        return true;
    }

    sequenceRestored = (seq: number, state: Buffer) => {
        if (seq <= this._validatedSeq) {
            return; // Too Old
        }
        this._maxReceivedSeq = Math.max(seq, this._maxReceivedSeq);
        this._validatedSeq = seq;
        this._validatedState = state;

        // Remove old pending
        for (let s of [...this._pendingSeq.keys()]) {
            if (s <= seq) {
                this._pendingSeq.delete(s);
            }
        }

        // Handle remaining pending
        while (this._pendingSeq.size > 0) {
            if (this._pendingSeq.has(this._validatedSeq + 1)) {
                let st = this._pendingSeq.get(this._validatedSeq + 1)!;
                this._pendingSeq.delete(this._validatedSeq + 1);
                this._validatedSeq++;
                this._validatedState = st;
            } else {
                break;
            }
        }
    }
}