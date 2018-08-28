import { exponentialBackoffDelay } from './exponentialBackoffDelay';

class RateLimit {
    private data = new Map<string, number>();

    constructor(
        private windowSizeMs: number,
        private requestsPerWindow: number,
        private softMode: boolean = true
    ) {
        setInterval(() => {
            this.data.clear();
        }, this.windowSizeMs);
    }

    hit(cId: string) {
        if (!this.data.has(cId)) {
            this.data.set(cId, 1);
            return;
        }

        let hits = this.data.get(cId);
        this.data.set(cId, hits! + 1);
    }

    canHandle(cId: string): { canHandle: boolean, delay: number } {
        let clientHits = this.data.get(cId) || 1;
        let delay = 0;
        let canHandle = clientHits <= this.requestsPerWindow;

        if (!canHandle && this.softMode) {
            delay = exponentialBackoffDelay(clientHits, 1000, 1000, 100);
        }

        return {
            canHandle,
            delay
        };
    }
}

export const Rate = {
    HTTP: new RateLimit(1000, 50, true),
    WS: new RateLimit(1000, 50, true),
};