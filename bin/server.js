const attach = require('neovim').attach
const logger = require('../lib/logger')('server')

let nvim

if (process.env.NVIM_LISTEN_ADDRESS) {
  nvim = attach({
    socket: process.env.NVIM_LISTEN_ADDRESS
  })
} else {
  nvim = attach({
    socket: {
      port: process.env.NVIM_LISTEN_PORT,
      host: '127.0.0.1'
    }
  })
}

nvim.on('notification', (method, args) => {
  logger.info('notification', method, JSON.stringify(args))
})

nvim.on('request', (method, args, resp) => {
  let len = args[0]
  let buffer = Buffer.alloc(len, 'a')
  resp.send({r: buffer.toString('ascii')})
})

nvim.channelId.then(async channelId => {
  await nvim.setVar('channel_id', channelId)
  nvim.command('doautocmd User ServerInit')
  await benchMark()
})

process.on('uncaughtException', function(err) {
  logger.error('uncaughtException', err.stack)
})

process.on('unhandledRejection', (reason, p) => {
  logger.error('unhandledRejection', reason)
})

async function benchMark() {
  let counts = [10, 100, 1024, 10240]
  for (let c of counts) {
    let now = Date.now()
    for (let i = 0; i < 1000; i++) {
      await nvim.call('CreateData', c)
    }
    logger.info('Cost: ', c, Date.now() - now)
  }
}
