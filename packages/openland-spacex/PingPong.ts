import { SpaceXConnection } from './SpaceXConnection';
import { delay } from '../openland-utils/timer';
import { asyncRun } from './utils/asyncRun';

export class PingPong {
    private running = true;
    private lastPingAck: number = Date.now();
    private pingCounter = 0;
    private pingAckCounter = 0;

    constructor(
        private connection: SpaceXConnection
    ) {

    }

    start = () => {
        asyncRun(async () => {
            let timeout: NodeJS.Timeout | null = null;
            while (this.running) {
                // Send ping only if previous one was acknowledged
                if (this.pingCounter !== this.pingAckCounter) {
                    await delay(1000 * 30);
                }
                this.sendPing();
                if (timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(() => {
                    if (this.running && Date.now() - this.lastPingAck > 1000 * 60 * 5) {
                        this.connection.close();
                    }
                }, 1000 * 60 * 5);
                await delay(1000 * 30);
            }
        });
    }

    private sendPing = () => {
        this.connection.send({ type: 'ping' });
        this.pingCounter++;
    }

    onPing = () => this.connection.send({ type: 'pong' });

    onPong = () => {
        this.lastPingAck = Date.now();
        this.pingAckCounter++;
    }

    terminate = () => {
        this.running = false;
    }
}