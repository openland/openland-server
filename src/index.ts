import * as db from './connector'
import * as api from './api'
import * as dev from './dev'

async function init() {
  try {
    if (process.env.NODE_ENV == "development") {
      console.info("Connecting to database in DEVELOPMENT mode")
      await db.connection.sync({ force: true })
      await dev.InitSampleData()
    } else {
      console.info("Connecting to database in RELEASE mode")
      await db.connection.sync({ force: true })
      await dev.InitSampleData()
    }
    console.info("Starting API endpoint")
    await api.default()
  } catch (e) {
    console.error("Unable to init server")
    console.error(e)
  }
}

init()