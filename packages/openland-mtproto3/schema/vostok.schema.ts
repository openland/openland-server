import { anyStruct, array, declareSchema, field, integer, model, optional, string } from './vschema';

export const VostokSchema = declareSchema(() => {
    model('Message', () => {
        field('seq', integer());
        field('body', anyStruct());
        field('ackSeqs', optional(array(integer())));
    });

    model('AckMessages', () => {
        field('seqs', array(integer()));
    });

    model('MessagesInfoRequest', () => {
        field('seqs', array(integer()));
    });

    model('Initialize', () => {
        field('authToken', string());
    });

    model('InitializeAck', () => {
        //
    });

    model('Ping', () => {
        field('id', integer());
    });

    model('Pong', () => {
        field('id', integer());
    });

    model('GQLRequest', () => {
        field('id', string());
        field('operationName', optional(string()));
        field('query', string());
        field('variables', optional(string()));
    });

    model('GQLResponse', () => {
        field('id', string());
        field('result', string());
    });

    model('GQLSubscription', () => {
        field('id', string());
        field('operationName', optional(string()));
        field('query', string());
        field('variables', optional(string()));
    });

    model('GQLSubscriptionStop', () => {
        field('id', string());
    });

    model('GQLSubscriptionResponse', () => {
        field('id', string());
        field('result', string());
    });

    model('GQLSubscriptionComplete', () => {
        field('id', string());
    });
});