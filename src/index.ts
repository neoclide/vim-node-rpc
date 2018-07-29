#!/usr/bin/env node

import Connection from './model/connection'
import Request from './model/request'
import Server from './model/server'
const logger = require('./logger')('index')

const conn = new Connection(process.stdin, process.stdout)
const request = new Request(conn)
const sockFile = process.env.NVIM_LISTEN_ADDRESS
const server = new Server(sockFile, request)

server.on('ready', () => {
  conn.notify('ready')
})

server.on('connect', clientId => {
  conn.notify('connect', clientId)
})

server.on('disconnect', clientId => {
  conn.notify('disconnect', clientId)
})

server.on('notification', (event, args) => {
  if (!conn.isReady) return
  if (event == 'nvim_call_function') {
    conn.call(true, args[0], args[1])
  } else if (event == 'nvim_command') {
    conn.expr(true, args[0])
  } else {
    logger.error(`Unknown event:`, event, args)
  }
})

conn.on('ready', async () => {
  conn.on('request', async (id, obj) => {
    let [clientId, method, args] = obj
    try {
      let res = await server.request(clientId, method, args)
      conn.response(id, [null, res])
    } catch (e) {
      console.error(e.message) // tslint:disable-line
      conn.response(id, [e.message, null])
    }
  })

  conn.on('notification', obj => {
    let [clientId, method, args] = obj
    server.notify(clientId, method, args)
  })
})

process.on('uncaughtException', err => {
  logger.error('uncaughtException', err.stack)
  console.error(`[rpc.vim] rpc error ${err.message}`) // tslint:disable-line
})

process.on('unhandledRejection', (reason, p) => {
  logger.error('unhandledRejection', reason)
  let msg = '[rpc.vim] Unhandled Rejection at:' + p + ' reason: ' + reason
  console.error(msg) // tslint:disable-line
})
