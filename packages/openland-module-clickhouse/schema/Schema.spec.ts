import {
    schema, string, integer, boolean, struct, date, nullable, TypeFromSchema,
} from '.';

it('should-create-correctly', async () => {
    let s = schema({
        kek: string(),
        lol: nullable(integer()),
        bool: boolean(),
        date: nullable(date()),
        nested: struct({
            kek: string()
        })
    });
    expect(s.fields).toEqual([{ name: 'kek', field: { type: 'string', dbType: 'String' } }, {
        name: 'lol', field: { type: 'number', dbType: 'Int64', nullable: true }
    }, { name: 'bool', field: { type: 'boolean', dbType: 'UInt8' } }, {
        name: 'date', field: { type: 'date', dbType: 'DateTime', nullable: true }
    }, {
        name: 'nested.kek', field: { type: 'string', dbType: 'String' }
    }]);
});

it('should-map-objects-correctly', async () => {
    let s = schema({
        kek: string(),
        lol: nullable(integer()),
        bool: boolean(),
        date: nullable(date()),
        nested: struct({
            kek: string()
        }),
        nullableStruct: struct({
            flex: nullable(string())
        })
    });

    let obj: TypeFromSchema<typeof s> = {
        nested: {
            kek: '12'
        },
        lol: null,
        kek: 'lol',
        bool: false,
        date: 1590515472000,
        nullableStruct: {
            flex: null
        },
    };
    let values = s.mapToDb(obj);

    let expectedValues = ['lol', null, 0, 1590515472, '12', null];
    expect(values).toEqual(expectedValues);

    let obj2 = s.mapFromDb(values);
    expect(obj2).toEqual(obj);
});