import Connection from './model/connection'
import Request from './model/request'
import Server from './model/server'
const logger = require('./logger')('index')

const conn = new Connection(process.stdin, process.stdout)
const request = new Request(conn)

conn.on('ready', async () => {
  let server = new Server(conn.tempfile, request)
  conn.on('request', async (id, obj) => {
    let [method, args] = obj
    try {
      let res = await server.request(method, args)
      conn.response(id, res)
    } catch (e) {
      console.error(e.message) // tslint:disable-line
    }
  })

  conn.on('notification', obj => {
    let [method, args] = obj
    server.notify(method, args)
  })

  server.on('ready', () => {
    conn.notify('ready')
  })
})

process.on('uncaughtException', err => {
  logger.error('uncaughtException', err.stack)
})

process.on('unhandledRejection', reason => {
  logger.error('unhandledRejection', reason)
})

