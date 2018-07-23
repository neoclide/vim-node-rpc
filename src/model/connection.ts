import Emitter from 'events'
const logger = require('../logger')('connection')

export default class Connection extends Emitter {
  private _ready: boolean
  private _channel: number

  constructor(
    private readable:NodeJS.ReadableStream,
    private writeable:NodeJS.WritableStream) {
    super()
    this._ready = false
    this.readable = process.stdin
    this.readable.setEncoding('utf8')
    this.writeable = process.stdout
    let buffered = ''
    this.readable.on('data', (chunk:string) => {
      let idx = chunk.indexOf('\n')
      if (idx !== -1) {
        let parts = chunk.split('\n')
        let first = parts.shift()
        this.parseData(buffered + first)
        buffered = ''
        while(parts.length) {
          let str = parts.shift()
          if (str.length) {
            this.parseData(str)
          }
        }
      } else {
        buffered = buffered + chunk
      }
    })
  }

  private parseData(data):void {
    let arr:any[]
    try {
      arr = JSON.parse(data)
    } catch (e) {
      logger.error('Invalid data from vim', data)
    }
    let [id, obj] = JSON.parse(data)
    if (arr.length > 2) {
      logger.error('Result array length > 2', arr)
    }
    if (id > 0) {
      this.emit('request', id, obj)
    } else if (id == 0) {
      if (obj[0] == 'ready') {
        let [channel, fns] = obj[1]
        this._channel = channel
        this._ready = true
        this.emit('ready', fns)
      } else {
        this.emit('notification', obj)
      }
    } else {
      logger.debug('received response', id, obj)
      // response for previous request
      this.emit('response', id, obj)
    }
  }

  public get channelId():Promise<number> {
    if (this._ready) {
      return Promise.resolve(this._channel)
    }
    return new Promise(resolve => {
      this.once('ready', () => {
        resolve(this._channel)
      })
    })
  }

  public get isReady():boolean {
    return this._ready
  }

  public response(requestId:number, data?:any):void {
    this.send([requestId, data || null])
  }

  public notify(event:string, data?:any):void {
    this.send([0, [event, data || null]])
  }

  public send(arr:any[]):void {
    this.writeable.write(JSON.stringify(arr) + '\n')
  }

  public redraw(force = false):void {
    this.send(['redraw', force])
  }

  public commmand(cmd:string):void {
    this.send(['ex', cmd])
  }

  public normal(cmd:string):void {
    this.send(['normal', cmd])
  }

  public expr(requestId:number, expr:string):void {
    this.send(['expr', expr, requestId])
  }

  // nvim always require a response, so requestId is required
  public call(requestId:number, func:string, args:any[]):void {
    if (requestId >= 0) {
      logger.error('invalid requestId', requestId)
      return
    }
    this.send(['call', func, args, requestId])
  }
}
