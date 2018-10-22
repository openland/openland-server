export class XAsyncIterator<T> {
    private events: T[] = [];
    private resolvers: any[] = [];
    private onExit: () => void;

    constructor(
        onExit: () => void
    ) {
        this.onExit = onExit;
    }

    pushEvent(event: T) {
        if (this.resolvers.length > 0) {
            this.resolvers.shift()({
                value: event,
                done: false
            });
        } else {
            this.events.push(event);
        }
    }

    getIterator() {
        const getValue = () => {
            return new Promise((resolve => {
                if (this.events.length > 0) {
                    let val = this.events.shift();

                    resolve({
                        value: val,
                        done: false
                    });
                } else {
                    this.resolvers.push(resolve);
                }
            }));
        };

        let onReturn = () => {
            this.events = [];
            this.resolvers = [];
            this.onExit();
            return Promise.resolve({ value: undefined, done: true });
        };

        return {
            next(): any {
                return getValue();
            },
            return: onReturn,
            throw(error: any) {
                return Promise.reject(error);
            },
            [Symbol.asyncIterator]() {
                return this;
            }
        };
    }
}