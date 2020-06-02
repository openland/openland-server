import { currentRunningTime } from 'openland-utils/timer';

export class TokenBucket {
    readonly #maxTokens: number;
    readonly #refillDelay: number;
    readonly #refillAmount: number;
    #tokens: number;
    #lastUpdate: number;

    constructor(opts: { maxTokens: number, refillDelay: number, refillAmount: number }) {
        this.#maxTokens = opts.maxTokens;
        this.#refillDelay = opts.refillDelay;
        this.#refillAmount = opts.refillAmount;
        this.#tokens = opts.maxTokens;
        this.#lastUpdate = currentRunningTime();
    }

    get availableTokens() {
        this.#refillIfNeeded();
        return this.#tokens;
    }

    tryTake(count: number = 1) {
        this.#refillIfNeeded();
        if (this.#maxTokens < count) {
            throw Error('Bucket is too small');
        }
        if (this.#tokens < count) {
            return false;
        }

        // Reset refil timer
        if (this.#tokens === this.#maxTokens) {
            this.#lastUpdate = currentRunningTime();
        }
        this.#tokens -= count;
        return true;
    }

    #refillIfNeeded = () => {
        if (this.#tokens >= this.#maxTokens) {
            return;
        }
        let refillMaxAmount = this.#refillAmount * Math.floor(((currentRunningTime() - this.#lastUpdate) / this.#refillDelay));
        let refillAmount = Math.min(refillMaxAmount, this.#maxTokens - this.#tokens);
        if (refillAmount > 0) {
            this.#tokens += refillAmount;
            this.#lastUpdate += refillAmount * this.#refillDelay;
        }
    }
}