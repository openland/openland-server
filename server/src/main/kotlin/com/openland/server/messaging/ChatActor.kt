package com.openland.server.messaging

import akka.actor.UntypedActor

class ChatActor : UntypedActor() {
    override fun onReceive(p0: Any) {
        TODO("not implemented")
    }
}

data class ChatSendMessage(val uid: Int)