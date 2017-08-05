import * as db from './connector'
import * as api from './api'

async function init() {
  try {
    console.info("Connecting to database")
    await db.connection.sync({alter: true})
    console.info("Starting API endpoint")
    await api.default()
  } catch (e) {
    console.error("Unable to init server")
    console.error(e)
  }
}

init()