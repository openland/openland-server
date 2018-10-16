package com.openland.server.tables

import org.jetbrains.exposed.sql.Table

object Organizations : Table("organizations") {
    val id = integer("id").autoIncrement().primaryKey()
    val name = varchar("name", 255)
    val website = varchar("website", 255).nullable()
    val photo = varchar("website", 255).nullable()
}