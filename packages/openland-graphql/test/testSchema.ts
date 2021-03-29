import { buildSchema, parse } from 'graphql';

const schema = `
    type User {
        id: ID!
        firstName: String!
        lastName: String!
    }

    type Query { 
        hello: String
        me: User!
    }
`;

const meMultiple = `{
    me {
        id
        firstName
    }
    me {
        lastName
    }
}`;

export const testSchema = {
    schema: buildSchema(schema),
    query: {
        meMultiple: parse(meMultiple)
    }
};