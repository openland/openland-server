export class SLog {
    private readonly name: String;

    constructor(name: String) {
        this.name = name;
    }

    log = (text: string) => {
        console.log('[' + this.name + ']: ' + text);
    }
}

export function createLogger(name: string): SLog {
    return new SLog(name);
}