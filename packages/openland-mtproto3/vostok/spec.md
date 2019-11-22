# Vostok proto description

Vostok is transport-agnostic & serialization-agnostic network protocol.
In this implementation it uses WebSockets and JSON respectively.

## Messages
There is two types of messages: regular ones and service ones.
Main difference between them is that service messages has no need to be acknowledged and they don't have id.
Each regular message have unique string ID and should be acknowledged by host.
If server receives invalid message (unknown type, corrupted data, etc), then `InvalidMessage` message is send and connection is closed.

## Session
Session is an abstraction on top of connection. One session can contain several connections.
Incoming and outgoing messages from all connections are cached for some time in session.
Server always sends updates & responses to the connection from which the last `Pong` came
Sessions are stored in server memory for quite time, so client can reconnect to session with no need to setup subscriptions, etc.

## Initialization process
First message in connection is always `Initialize` service message. 
If everything is ok - server sends `InitializeAck` message with `sessionId` field which is id of session.
If client already have session he can pass `sessionId` with `Initialize` message, in that case if server still have that session `InitializeAck.sessionId` and `Initialize.sessionId` are equal.
If server has forgotten that session - new one is created.
 
## Service messages
 
#### Ping & Pong
Both sides periodically send `Ping` messages with some id and expect a response `Pong` with same id.
Connection is closed if `Pong` is not received for some sensible time.

#### MessagesContainer
This service message is a simple container for service/regular messages.

#### AckMessages
Acknowleges messages

#### MessagesInfoRequest

Can be sent from both sides. Typically this message is sent when host did't acknowledged some message.

Possible responses: 

- AckMessages: the host already processed message, most likely the ack for message was lost
- MessageNotFoundResponse the host has no info about message or message was forgotten already, in most cases client should resend that message

#### ResendMessageRequest
Can be sent from both sides. Typically used by client when server doesn't send answer for some message for some sensible.

Possible responses:
- Copy of original answer “as is”
- `MessageNotFoundResponse` response not found or already was forgotten by host
- `MessageIsProcessingResponse` - request is still in processing phase 


