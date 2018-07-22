const attach = require('neovim').attach
const logger = require('../lib/logger')('server')

const nvim = attach({
  socket: process.env.NVIM_LISTEN_ADDRESS
})


nvim.on('notification', (method, args) => {
  logger.info('notification', method, JSON.stringify(args))
})

nvim.on('request', (method, args, resp) => {
  logger.info('request', method, JSON.stringify(args))
  resp.send({result: 'ok'})
})

nvim.channelId.then(channelId => {
  logger.info('Received channelId', channelId)
})

process.on('uncaughtException', function(err) {
  logger.error('uncaughtException', err.stack)
})

process.on('unhandledRejection', (reason, p) => {
  logger.error('unhandledRejection', reason)
})
