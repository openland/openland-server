import * as db from './connector'
import * as api from './api'
import * as sample from './sample';
import * as cluster from 'cluster';

if (cluster.isMaster) {
  initMater()
} else {
  initWorker()
}

async function initMater() {
  try {
    if (process.env.NODE_ENV == "development") {
      console.info("Connecting to database in DEVELOPMENT mode")
      await db.connection.getQueryInterface().dropAllTables()
      await db.migrate()
      await sample.createEmptyData()
    } else {
      console.info("Connecting to database in RELEASE mode")
      await db.migrate()
    }
    require('./imports')

    if (process.env.WEB_CONCURRENCY) {
      for (var i = 0; i < parseInt(process.env.WEB_CONCURRENCY!!); i++) {
        cluster.fork()
      }
    } else {
      initWorker()
    }
  } catch (e) {
    console.error("Unable to init server")
    console.error(e)
  }
}

async function initWorker() {
  api.default()
}

// async function init(worker?: number) {
//   try {
//     console.log(worker)
//     if (!worker) {

//     }
//     require('./imports')

//     throng(4, launchWorker)
//   } catch (e) {
//     console.error("Unable to init server")
//     console.error(e)
//   }
// }

// function launchWorker(worker: number) {
//   api.default()
// }

// init()
// function start() {
//   init()
// }

// const WORKERS = process.env.WEB_CONCURRENCY || 1;

// init()