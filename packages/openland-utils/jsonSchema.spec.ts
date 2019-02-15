import {
    jEnum,
    jField,
    jNumber,
    json,
    jString,
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
});