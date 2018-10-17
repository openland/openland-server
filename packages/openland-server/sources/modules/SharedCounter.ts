import { getFTransaction } from './FTransaction';

export class SharedCounter {

    readonly name: string;

    constructor(name: string) {
        this.name = name;
    }

    get = async () => {
        let r = (await getFTransaction().get(['counters', this.name]));
        if (r) {
            return r.value;
        } else {
            return 0;
        }
    }

    set = async (v: number) => {
        await getFTransaction().set(['counters', this.name], { value: v });
    }
}