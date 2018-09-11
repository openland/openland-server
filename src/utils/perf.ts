export class Perf {
    private data = new Map<string, number>();
    private names: string[] = [];

    start(name: string) {
        this.data.set(name, Date.now());
        this.names.push(name);
    }

    end(name: string) {
        this.data.set(name + '_end', Date.now());
    }

    print() {
        console.log('\n\n\n-----PERF----');
        for (let name of this.names) {
            let start = this.data.get(name)!;
            let end = this.data.get(name + '_end');

            if (!end) {
                throw new Error('Perf error');
            }

            console.log(`${name} - ${end - start}`);
        }
        console.log('---ENDPERF---\n\n\n');
    }
}