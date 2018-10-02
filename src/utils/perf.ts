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

        console.log(text);
    }
}