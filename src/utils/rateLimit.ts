class RateLimit {
    private data = new Map<string, number>();

    constructor(
        private requestsPerSec: number
    ) {
        setInterval(() => {
            this.data.clear();
        }, 1000);
    }

    hit(cId: string) {
        if (!this.data.has(cId)) {
            this.data.set(cId, 1);
            return;
        }

        let hits = this.data.get(cId);
        this.data.set(cId, hits! + 1);
    }

    canHandle(cId: string) {
        return true || !(this.data.has(cId) && this.data.get(cId)! > this.requestsPerSec);
    }
}

export const Rate = {
    HTTP: new RateLimit(3),
    WS: new RateLimit(3),
};