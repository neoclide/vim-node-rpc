import Emitter from 'events'
const logger = require('../logger')('connection')

export default class Connection extends Emitter {
  private _ready: boolean
  private _channel: number
  private _tempfile: string

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
      buffered = buffered + chunk
      if (buffered.endsWith('\n')) {
        let data = buffered
        buffered = ''
        try {
          let [id, obj] = JSON.parse(data)
          if (typeof id !== 'number') {
            logger.error('invalid request')
            return
          }
          if (id > 0) {
             this.emit('request', id, obj)
          } else if (id == 0) {
            if (obj[0] == 'ready') {
              let [channel, fns, tempname] = obj[1]
              this._channel = channel
              this._tempfile = tempname
              this._ready = true
              this.emit('ready', fns)
            } else {
              this.emit('notification', obj)
            }
          } else {
            // response for previous request
            this.emit('response', id, obj)
          }
        } catch (e) {
          logger.error('request error: ', e.message)
        }
      } else if (buffered.indexOf('\n') !== -1) {
        logger.error('Invalid data received from vim', buffered)
      }
    })
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

  public get tempfile():string {
    return this._tempfile
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
