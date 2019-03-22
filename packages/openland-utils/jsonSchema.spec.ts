import {
    jBool,
    jEnum, jEnumString,
    jField,
    jNumber,
    json,
    jString, jVec,
    validateJson
} from './jsonSchema';

describe('jsonSchema', () => {
    it('should validate basic object', async () => {
        let schema = json(() => {
            jField('firstName', jString());
            jField('lastName', jString());
            jField('hello', jString(), true);
        });

        expect(validateJson(schema, { firstName: '1', lastName: '2' })).toEqual(true);
    });

    it('should validate type-enums', async () => {
        let schema = jEnum(
            json(() => {
                jField('type', jString('user_mention'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('user', jNumber());
            }),
            json(() => {
                jField('type', jString('room_mention'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('room', jNumber());
            }),
            json(() => {
                jField('type', jString('link'));
                jField('offset', jNumber());
                jField('length', jNumber());
                jField('url', jString());
            }),
        );

        let input = {
            type: 'user_mention',
            offset: 1,
            length: 2,
            user: 1
        };
        expect(validateJson(schema, input)).toEqual(true);
    });

    it('should crash on wrong type', async () => {
        let schema = json(() => {
            jField('test', jNumber());
        });
        expect(() => validateJson(schema, { test: true })).toThrow('Field root.test must be number, got: true');
        schema = json(() => {
            jField('test', jString());
        });
        expect(() => validateJson(schema, { test: true })).toThrow('Field root.test must be string, got: true');
        schema = json(() => {
            jField('test', jString('test'));
        });
        expect(() => validateJson(schema, { test: true })).toThrow('Field root.test must be string, got: true');
        schema = json(() => {
            jField('test', jBool());
        });
        expect(() => validateJson(schema, { test: 1 })).toThrow('Field root.test must be boolean, got: 1');
    });

    it('should work with non-object root type', async () => {
        expect(validateJson(jNumber(), 1)).toEqual(true);
        expect(validateJson(jString(), '1')).toEqual(true);
        expect(validateJson(jBool(), true)).toEqual(true);
        expect(validateJson(jEnumString('1', '2', '3'), '1')).toEqual(true);
        expect(validateJson(jVec(jNumber()), [1])).toEqual(true);
        expect(validateJson(jEnum(jNumber(), jString()), 1)).toEqual(true);
    });

    it('schema declaration should work correctly', async () => {
        let schema = json(() => {
            jField('test', jNumber());
        });
        let schema2 = json(() => {
            jField('test', jString());
        });
        let schema3 = json(() => {
            jField('test', json(() => {
                jField('test', jString());
            }));
        });

        expect(validateJson(schema, { test: 1 })).toEqual(true);
        expect(validateJson(schema2, { test: '1' })).toEqual(true);
        expect(validateJson(schema3, { test: { test: '1' } })).toEqual(true);
    });

    it('should correctly validate nullable fields', async () => {
        let schema = json(() => {
            jField('isImage', jNumber(), true);
        });
        expect(validateJson(schema, {  })).toEqual(true);
        expect(validateJson(schema, { isImage: null })).toEqual(true);
        expect(validateJson(schema, { isImage: 1 })).toEqual(true);
    });
});