const attach = require('@chemzqm/neovim').attach
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

nvim.on('request', (_method, args, resp) => {
  let buffer = Buffer.alloc(args[0], 'a')
  resp.send({ r: buffer.toString('ascii') })
})

nvim.channelId.then(async channelId => {
  await nvim.setVar('channel_id', channelId)
  nvim.command('doautocmd User ServerInit')
  await benchMark()
  await nvim.call('StartProfile', [])
})

process.on('uncaughtException', function (err) {
  logger.error('uncaughtException', err.stack)
})

process.on('unhandledRejection', (reason, p) => {
  logger.error('unhandledRejection', reason)
})

async function benchMark() {
  let counts = [10240, 102400, 1024000]
  for (let c of counts) {
    let now = Date.now()
    for (let i = 0; i < 100; i++) {
      await nvim.call('CreateData', c)
    }
    logger.info('Cost: ', c, (Date.now() - now) / 100)
  }
}
