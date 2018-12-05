import Emitter from 'events'
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
    let buffered = Buffer.alloc(0)
    this.readable.on('data', (chunk: Buffer) => {
      let start = 0
      for (const pair of chunk.entries()) {
        const [idx, b] = pair
        if (b == 10) {
          this.parseData(Buffer.concat([buffered, chunk.slice(start, idx)]))
          start = idx + 1
          buffered = Buffer.alloc(0)
        }
      }
      if (start == 0) {
        buffered = Buffer.concat([buffered, chunk])
      } else if (start != chunk.length) {
        buffered = chunk.slice(start)
      }
    })
  }

  private parseData(buf: Buffer): void {
    if (buf.length == 0) return
    let str = buf.toString('utf8')
    let arr: any[]
    try {
      arr = JSON.parse(str)
    } catch (e) {
      logger.error('Invalid data from vim', str)
    }
    let [id, obj] = JSON.parse(str)
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
      logger.debug('received response', id, obj)
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
    this.writeable.write(JSON.stringify(arr) + '\n')
  }

  public redraw(force = false): void {
    this.send(['redraw', force ? 'force' : ''])
  }

  public commmand(cmd: string): void {
    this.send(['ex', cmd])
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
      this.send(['call', func, args])
      return
    }
    this.send(['call', func, args, requestId])
  }
}
