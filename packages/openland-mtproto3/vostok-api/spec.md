# Graphql Mobile Protocol

### Uses Vostok proto for network layer

### Known message types used in `Message`

- 3 - GQLRequest
- 4 - GQLResponse
- 5 - GQLSubscription
- 6 - GQLSubscriptionStop
- 7 - GQLSubscriptionResponse
- 8 - GQLSubscriptionComplete
- 9 - GQLCachedQueryNotFound 

## Basic query request
To perform GQL request you should send `GQLRequest` message with fields below: 

- id - random unique string
- operationName - name of query (optional)
- query - string containing query in gql language 
- variables - string with JSON-encoded map with arguments ( example: '{"a": "b"}' )
- queryId - query id for cached queries (described below)

Server will return `GQLResponse` message with same `id` field and `result` field, containing string with JSON-encoded response.

## Subscriptions

Subscriptions works pretty much the same as queries. 
To start subscription you send `GQLSubscription` message with same fields as `GQLRequest`
Events returned in `GQLSubscriptionResponse` message.
When subscription ends server sends `GQLSubscriptionComplete` message.
Client can stop subscription by sending `GQLSubscriptionStop` message.

## Cached queries
In order to optimize network traffic client can send spacial short string (queryId) instead of whole query.

`queryId = sha256(JSON.stringify({ query: '', name: '' }))`

- query - GQL query
- name - same as `operationName`

If this query is not cached on server side - server sends `GQLCachedQueryNotFound` message.
