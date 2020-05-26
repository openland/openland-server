import {
    schema,
    string,
    integer,
    boolean,
    struct,
    date
} from './Schema';

it('should-create-correctly', async () => {
    let s = schema({
        kek: string(),
        lol: integer(true),
        bool: boolean(),
        date: date(true),
        nested: struct({
            kek: string()
        })
    });
    let fields = s.getFields();
    expect(fields).toEqual([ { name: 'kek', type: 'string', nullable: false },
        { name: 'lol', type: 'number', nullable: true },
        { name: 'bool', nullable: false, type: 'boolean'},
        { name: 'date', nullable: true, type: 'date'},
        { name: 'nested_kek', type: 'string', nullable: false } ]);
});