export class CodeBuilder {
    private result = '';
    private tabC = 0;

    tab() {
        this.tabC++;
    }

    unTab() {
        this.tabC--;
    }

    add(text?: string, moveLine?: boolean) {
        if (text) {
            this.result += ' '.repeat(this.tabC * 4) + text + ((moveLine !== false) ? '\n' : '');
        } else {
            this.result += '\n';
        }
    }

    addMultiline(text: string) {
        let lines = text.split('\n');
        for (let line of text.split('\n')) {
            if (line === '') {
                continue;
            }
            this.add(line, !(lines.indexOf(line) === (lines.length - 1)));
        }
    }

    addCode(code: CodeBuilder) {
        this.addMultiline(code.build());
    }

    build() {
        return this.result;
    }
}