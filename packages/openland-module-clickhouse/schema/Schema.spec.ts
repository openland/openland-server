import {
    schema,
    string,
    integer,
    boolean,
    struct,
    date,
    nullable
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
    let fields = s.fields();
    expect(fields).toEqual([ { name: 'kek', type: 'string', nullable: false },
        { name: 'lol', type: 'number', nullable: true },
        { name: 'bool', nullable: false, type: 'boolean'},
        { name: 'date', nullable: true, type: 'date'},
        { name: 'nested_kek', type: 'string', nullable: false } ]);
});

it('should-map-objects-correctly', async () => {
    let s = schema({
        kek: string(),
        lol: nullable(integer()),
        bool: boolean(),
        date: nullable(date()),
        nested: struct({
            kek: string()
        })
    });

    let obj = {
        nested: {
            kek: '12'
        },
        lol: null,
        kek: 'lol',
        bool: false,
        date: 1590515471554,
    };
    let values = s.mapToDb(obj);

    let expectedValues = ['lol', null, false, 1590515471554, '12'];
    expect(values).toEqual(expectedValues);

    let obj2 = s.mapFromDb(values);
    expect(obj2).toEqual(obj);
});