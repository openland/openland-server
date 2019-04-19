import { GraphQLScalarType, Kind } from 'graphql';

export const Resolvers = {
    Date: new GraphQLScalarType({
        name: 'Date',
        description: 'Date type format, serialized as UNIX-time in string',
        serialize: (src: any) => {
            if (typeof src === 'number') {
                if (!Number.isInteger(src)) {
                    throw Error('Specified numeric date (' + src + ') is float');
                }
                if (src < 0) {
                    throw Error('Specified numberic date (' + src + ') is negative');
                }
                return src.toString();
            } else if (typeof src === 'string') {
                let res = parseInt(src, 10);
                if (!Number.isInteger(res)) {
                    throw Error('Specified numeric date (' + src + ') is float');
                }
                if (res < 0) {
                    throw Error('Specified numberic date (' + src + ') is negative');
                }
                return res.toString();
            } else if (src instanceof Date) {
                return src.getTime().toString();
            } else {
                throw Error('Unknown date type (' + src + ')');
            }
        },
        parseLiteral: ast => {
            if (ast.kind !== Kind.STRING && ast.kind !== Kind.INT) {
                throw Error('Date input should be string');
            }
            if (typeof ast.value === 'string') {
                return new Date(parseInt(ast.value, 10));
            } else if (typeof ast.value === 'number') {
                return new Date(ast.value);
            }

            throw Error('Date input should be string');
        },
        parseValue: value => {
            return new Date(parseInt(value, 10));
        }
    })
};