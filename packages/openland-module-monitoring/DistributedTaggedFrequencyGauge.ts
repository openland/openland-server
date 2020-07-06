import { DistributedTaggedMachineGauge } from './DistributedTaggedMachineGauge';
import { currentRunningTime } from 'openland-utils/timer';

const AVERAGE_WINDOW = 5000;
const REPORT_WINDOW = 1000;
const MIN_OPS_TIME = 1000;

export class DistributedTaggedFrequencyGauge {
    readonly name: string;
    readonly gauge: DistributedTaggedMachineGauge;

    private tags = new Map<string, { ops: number[], lastOpsTime: number }>();

    constructor(gauge: DistributedTaggedMachineGauge) {
        this.name = gauge.name;
        this.gauge = gauge;
    }

    start = () => {
        setInterval(() => {
            this.cleanup();
        }, AVERAGE_WINDOW);

        setInterval(() => {
            for (let k of [...this.tags.keys()]) {
                let v = this.tags.get(k)!;
                let time = currentRunningTime();
                if (time - v.lastOpsTime < MIN_OPS_TIME) {
                    continue;
                }
                let hz = Math.floor(v.ops.length / ((time - v.lastOpsTime) / 1000));
                this.gauge.set(k, hz);
            }
        }, REPORT_WINDOW);
    }

    inc = (tag: string) => {
        let time = currentRunningTime();
        let ex = this.tags.get(tag);
        if (!ex) {
            this.tags.set(tag, { ops: [currentRunningTime()], lastOpsTime: time });
        } else {
            ex.ops.push(currentRunningTime());
        }
    }

    private cleanup = () => {
        for (let k of [...this.tags.keys()]) {
            let v = this.tags.get(k)!;
            let time = currentRunningTime();
            let cleanUntil = time - AVERAGE_WINDOW;
            v.lastOpsTime = cleanUntil;
            while (v.ops.length > 0 && v.ops[0] <= cleanUntil) {
                v.ops.shift();
            }
        }
    }
}