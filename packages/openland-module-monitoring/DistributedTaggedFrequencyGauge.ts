import { DistributedTaggedMachineGauge } from './DistributedTaggedMachineGauge';
import { currentRunningTime } from 'openland-utils/timer';
import { Config } from 'openland-config/Config';

const AVERAGE_WINDOW = 5000;
const REPORT_WINDOW = 1000;
const MIN_OPS_TIME = 1000;

export class DistributedTaggedFrequencyGauge {
    readonly name: string;
    readonly gauge: DistributedTaggedMachineGauge;

    private tags = new Map<string, { ops: { time: number, size: number }[], lastOpsTime: number }>();

    constructor(gauge: DistributedTaggedMachineGauge) {
        this.name = gauge.name;
        this.gauge = gauge;
    }

    start = () => {
        if (Config.enableReporting) {
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
                    let sum = 0;
                    for (let o of v.ops) {
                        sum += o.size;
                    }
                    let hz = Math.floor(sum / ((time - v.lastOpsTime) / 1000));
                    this.gauge.set(k, hz);
                }
            }, REPORT_WINDOW);
        }
    }

    inc = (tag: string) => {
        if (Config.enableReporting) {
            let time = currentRunningTime();
            let ex = this.tags.get(tag);
            if (!ex) {
                this.tags.set(tag, { ops: [{ time: currentRunningTime(), size: 1 }], lastOpsTime: time });
            } else {
                ex.ops.push({ time: currentRunningTime(), size: 1 });
            }
        }
    }

    add = (tag: string, size: number) => {
        if (Config.enableReporting) {
            let time = currentRunningTime();
            let ex = this.tags.get(tag);
            if (!ex) {
                this.tags.set(tag, { ops: [{ time: currentRunningTime(), size }], lastOpsTime: time });
            } else {
                ex.ops.push({ time: currentRunningTime(), size });
            }
        }
    }

    private cleanup = () => {
        for (let k of [...this.tags.keys()]) {
            let v = this.tags.get(k)!;
            let time = currentRunningTime();
            let cleanUntil = time - AVERAGE_WINDOW;
            v.lastOpsTime = cleanUntil;
            while (v.ops.length > 0 && v.ops[0].time <= cleanUntil) {
                v.ops.shift();
            }
        }
    }
}