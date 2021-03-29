import { buildSchema, parse } from 'graphql';

const schema = `
    type User {
        id: ID!
        firstName: String!
        lastName: String!
        username: String
        friends: User
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
        friends {
            id
            lastName
        }
    }
    me {
        id
        lastName
        username
        friends {
            id
            firstName
        }
    }
}`;

export const testSchema = {
    schema: buildSchema(schema),
    query: {
        meMultiple: parse(meMultiple)
    }
};