import { currentRunningTime } from 'openland-utils/timer';
import { DistributedMachineGauge } from './DistributedMachineGauge';

const AVERAGE_WINDOW = 5000;
const REPORT_WINDOW = 1000;
const MIN_OPS_TIME = 1000;

export class DistributedFrequencyGauge {
    readonly name: string;
    readonly gauge: DistributedMachineGauge;
    private readonly ops: number[] = [];
    private lastOpsTime: number = 0;

    constructor(gauge: DistributedMachineGauge) {
        this.name = gauge.name;
        this.gauge = gauge;
    }

    start = () => {
        setInterval(() => {
            this.cleanup();
        }, AVERAGE_WINDOW);

        setInterval(() => {
            if (this.lastOpsTime === 0) {
                return;
            }
            let time = currentRunningTime();
            if (time - this.lastOpsTime < MIN_OPS_TIME) {
                return;
            }
            let hz = Math.floor(this.ops.length / ((this.lastOpsTime - time) / 1000));
            this.gauge.set(hz);
        }, REPORT_WINDOW);
    }

    inc = () => {
        let time = currentRunningTime();
        if (this.lastOpsTime === 0) {
            this.lastOpsTime = time;
        }
        this.ops.push(currentRunningTime());
    }

    private cleanup = () => {
        if (this.lastOpsTime === 0) {
            return;
        }
        let time = currentRunningTime();
        let cleanUntil = time - AVERAGE_WINDOW;
        while (this.ops.length > 0 && this.ops[0] <= cleanUntil) {
            this.ops.shift();
        }
    }
}