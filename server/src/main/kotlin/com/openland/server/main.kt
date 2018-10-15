package com.openland.server

import akka.actor.ActorSystem

fun main(args: Array<String>) {
    val system = ActorSystem.create()
    println("Server started")
}