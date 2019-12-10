# Vostok proto description

Vostok is transport-agnostic mobile network protocol.

## Transport
Currently Vostok supports WebSocket and TCP transports.

#### WebSocket
Encoded protobuf messages are passed to WS socket as normal buffers (Uint8Array | Buffer in JS).

#### TCP
Message structure:\
|------------|----------|---------|\
| 0x77777777 |  length  | payload |\
|------------|----------|---------|\
Client must first send 0x77777777, then payload length as Big-Endiand Int32 and payload itself. 
 
## Message encoding
Vostok uses ProtoBuf for message encoding.
`TopMessage` is always a top-level message.
`Message` type which contains any user-defined message in `body` field could be sent in `TopMessage`.

## Message ID
Message ID is a unique 8 byte length sequence. Message ID is send as `bytes` in ProtoBuf.

## Messages
There is two types of messages: regular ones and service ones.
Main difference between them is that service messages has no need to be acknowledged and they don't have id.
Each regular message have unique ID and should be acknowledged by host.
If server receives invalid message (unknown type, corrupted data, etc), then `InvalidMessage` message is send and connection is closed.
If server or host receives copy of already message with same ID - message is acknowledged again.

## Session
Session is an abstraction on top of connection. One session can contain several connections.
Incoming and outgoing messages from all connections are cached for some time in session.
Server always sends updates & responses to the connection from which the last `Pong` came.
Sessions are stored in server memory for quite time, so client can reconnect to session with no need to setup subscriptions, etc.
Server can close session at any time. Also client should expect that server can forget any incoming/outgoing message at any time.

## Initialization process
First message in connection is always `Initialize` service message. 
If everything is ok - server sends `InitializeAck` message with `sessionId` field which is id of session.
If client already have session he can pass `sessionId` with `Initialize` message, in that case if server still have that session `InitializeAck.sessionId` and `Initialize.sessionId` are equal.
If server has forgotten that session - new one is created.
 
## Service messages
 
#### Ping & Pong
Both sides periodically send `Ping` messages with some id and expect a response `Pong` with same id.
Server sends `Ping` every 30 seconds and closes connection after 5 minutes if no corresponding `Pong` was received. 

#### MessagesContainer
This service message is a simple container for service/regular `TopMessage` messages.

#### AckMessages (service)
Acknowleges messages

#### MessagesInfoRequest (service)

Can be sent from both sides. Typically this message is sent when host did't acknowledged some message.
Server sends `MessagesInfoRequest` after 5 seconds if outgoing message was not acknowledged.

Possible responses: 

- AckMessages: the host already processed message, most likely the ack for message was lost
- MessageNotFoundResponse the host has no info about message or message was forgotten already, in most cases client should resend that message

#### ResendMessageRequest (service)
Can be sent from both sides. Typically used by client when server doesn't send answer for some message for some sensible.

Possible responses:
- Copy of original answer “as is”
- `MessageNotFoundResponse` response not found or already was forgotten by host
- `MessageIsProcessingResponse` - request is still in processing phase 


