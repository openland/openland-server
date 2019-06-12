export class Perf {
    private data = new Map<string, number>();
    private names: string[] = [];

    constructor(
        private name: string
    ) {

    }

    start(name: string) {
        this.data.set(name, Date.now());
        this.names.push(name);
    }

    end(name: string) {
        this.data.set(name + '_end', Date.now());
    }

    print() {
        let text = '';

        text += `\n\n\n-----PERF-${this.name}----`;

        for (let name of this.names) {
            let start = this.data.get(name)!;
            let end = this.data.get(name + '_end');

            if (!end) {
                throw new Error('Perf error');
            }

            text += (`${name} - ${end - start}\n`);
        }
        text += (`---ENDPERF-${this.name}---\n\n\n`);

        // tslint:disable
        console.log(text);
        // tslint:enable
    }
}

export async function perf<T>(name: string, cb: () => Promise<T>): Promise<T> {
    let start = Date.now();
    let res = await cb();
    
    // tslint:disable
    console.log(`perf ${name}: ${Date.now() - start} ms`);
    // tslint:enable

    return res;
}

export function perfSync<T>(name: string, cb: () => T): T {
    let start = Date.now();
    let res = cb();
    // tslint:disable
    console.log(`perf ${name}: ${Date.now() - start}`);
    // tslint:enable
    return res;
}