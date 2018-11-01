import * as fdb from 'foundationdb';
import { encode, decode } from './TupleEncoder';
import { BufferBuilder } from './BufferBuilder';
import Decimal from 'decimal.js';
import { RandomIDFactory } from 'openland-security/RandomIDFactory';

describe('TupleEncoder', () => {
    it('should encode the same way as a default one', () => {
        function testInput(key: string | number | boolean | null) {
            let builder = new BufferBuilder();
            encode(builder, key);
            let encoded = builder.make();
            let packed = fdb.encoders.tuple.pack([key]) as Buffer;
            let decoded = decode(encoded, { p: 0 });
            expect(encoded.toString('hex')).toEqual(packed.toString('hex'));
            expect(decoded).toEqual(key);
        }
        function testDecimalInput(key: number) {
            let builder = new BufferBuilder();
            encode(builder, new Decimal(key));
            let encoded = builder.make();
            let packed = fdb.encoders.tuple.pack([key]) as Buffer;
            let decoded = decode(encoded, { p: 0 });
            expect(encoded.toString('hex')).toEqual(packed.toString('hex'));
            expect(decoded).toEqual(key);
        }
        function testDecimalInput2(key: Decimal) {
            let builder = new BufferBuilder();
            encode(builder, new Decimal(key));
            let encoded = builder.make();
            let decoded = decode(encoded, { p: 0 });
            expect(decoded).toEqual(key);
        }
        testInput(0);
        testInput('hello');
        testInput(123);
        testInput(123123123);
        testInput(0.3);
        testInput(-0);
        testInput(-0.42);
        testDecimalInput(123);
        testDecimalInput(44412);
        testDecimalInput2(new Decimal('9223372036854775807'));
        let random = new RandomIDFactory(0);
        for (let i = 0; i < 1000; i++) {
            testDecimalInput2(new Decimal('0x' + random.next()));
        }
    });
});