import { Decimal } from 'decimal.js';

export class ID {
    readonly value: string;

    constructor(value: number | string) {
        if (typeof value === 'number') {
            if (value <= 0) {
                throw Error('ID can\'t be negative or zero');
            }
            if (!Number.isSafeInteger(value)) {
                throw Error('ID should be integers');
            }
        } else {
            if (value.length % 2 !== 0) {
                throw Error('ID is mailformed');
            }
            if (value.length < 2) {
                throw Error('ID is mailformed');
            }
            if (value.startsWith('00')) {
                throw Error('ID is mailformed');
            }
            if (!value.match(/^[0-9A-Fa-f]+$/)) {
                throw Error('ID is mailformed');
            }
        }
        let v = new Decimal((typeof value === 'number') ? value : '0x' + value);
        let hv = v.toHex().substring(2);
        if (hv.length % 2 !== 0) {
            hv = '0' + hv;
        }
        this.value = hv;
    }
}