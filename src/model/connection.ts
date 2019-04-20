import Emitter from 'events'
import readline from 'readline'
const logger = require('../logger')('connection')

export default class Connection extends Emitter {
  private _ready: boolean
  private _channel: number

  constructor(
    private readable: NodeJS.ReadableStream,
    private writeable: NodeJS.WritableStream) {
    super()
    this._ready = false
    this.readable = process.stdin
    this.writeable = process.stdout
    const rl = readline.createInterface(this.readable)
    rl.on('line', (line: string) => {
      this.parseData(line)
    })
    rl.on('close', () => {
      logger.error('stdin get closed')
      process.exit(0)
    })
  }

  private parseData(str: string): void {
    if (str.length == 0) return
    let arr: any[]
    try {
      arr = JSON.parse(str)
    } catch (e) {
      logger.error('Invalid data from vim', str)
      this.echoerr(`Invalid data: ${str}`)
      return
    }
    let [id, obj] = arr
    logger.debug('received request', id, obj)
    if (arr.length > 2) {
      logger.error('Result array length > 2', arr)
    }
    if (id > 0) {
      this.emit('request', id, obj)
    } else if (id == 0) {
      if (obj[0] == 'ready') {
        let [channel] = obj[1]
        this._channel = channel
        this._ready = true
        this.emit('ready', channel)
      } else {
        this.emit('notification', obj)
      }
    } else {
      // response for previous request
      this.emit('response', id, obj)
    }
  }

  public get channelId(): Promise<number> {
    if (this._ready) {
      return Promise.resolve(this._channel)
    }
    return new Promise(resolve => {
      this.once('ready', () => {
        resolve(this._channel)
      })
    })
  }

  public get isReady(): boolean {
    return this._ready
  }

  public response(requestId: number, data?: any): void {
    this.send([requestId, data || null])
  }

  public notify(event: string, data?: any): void {
    this.send([0, [event, data || null]])
  }

  public send(arr: any[]): void {
    logger.debug('send response', arr[0], arr.slice(1))
    this.writeable.write(JSON.stringify(arr) + '\n')
  }

  public redraw(force = false): void {
    this.send(['redraw', force ? 'force' : ''])
  }

  public commmand(cmd: string): void {
    this.send(['ex', cmd])
  }

  private echoerr(msg: string): void {
    this.commmand(`echoerr '${msg.replace(/'/, "''")}'`)
  }

  public normal(cmd: string): void {
    this.send(['normal', cmd])
  }

  public expr(isNotify: any, expr: string): void
  public expr(requestId: any, expr: string): void {
    if (typeof requestId === 'boolean' && requestId === true) {
      this.send(['expr', expr])
      return
    }
    this.send(['expr', expr, requestId])
  }

  // nvim always require a response, so requestId is required
  public call(isNotify: any, func: string, args: any[]): void
  public call(requestId: any, func: string, args: any[]): void {
    if (typeof requestId === 'boolean' && requestId === true) {
      // notify
      this.send(['call', func, args])
      return
    }
    this.send(['call', func, args, requestId])
  }
}
