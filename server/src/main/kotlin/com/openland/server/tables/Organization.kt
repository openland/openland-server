package com.openland.server.tables

import org.jetbrains.exposed.sql.Table

object Organizations : Table("organizations") {
    val id = integer("id").autoIncrement().primaryKey()
    val name = varchar("name",256)
}