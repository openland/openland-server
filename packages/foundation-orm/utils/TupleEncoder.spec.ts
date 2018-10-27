import * as fdb from 'foundationdb';
import { encode } from './TupleEncoder';
import { BufferBuilder } from './BufferBuilder';
import Decimal from 'decimal.js';

describe('TupleEncoder', () => {
    it('should encode the same way as a default one', () => {
        function testInput(key: string | number | boolean | null) {
            let builder = new BufferBuilder();
            encode(builder, key);
            let encoded = builder.make();
            let packed = fdb.encoders.tuple.pack([key]) as Buffer;
            expect(encoded.toString('hex')).toEqual(packed.toString('hex'));
        }
        function testDecimalInput(key: number) {
            let builder = new BufferBuilder();
            encode(builder, new Decimal(key));
            let encoded = builder.make();
            let packed = fdb.encoders.tuple.pack([key]) as Buffer;
            expect(encoded.toString('hex')).toEqual(packed.toString('hex'));
        }
        testInput('hello');
        testInput(123);
        testInput(123123123);
        testDecimalInput(123);
        testDecimalInput(44412);
    });
});