import { Transform } from 'stream'

const MIN_SIZE = Buffer.poolSize

export default class Buffered extends Transform {
  private chunks: Buffer[] | null
  private timer: NodeJS.Timer
  constructor() {
    super({
      readableHighWaterMark: 10 * 1024 * 1024,
      writableHighWaterMark: 10 * 1024 * 1024,
    } as any)
    this.chunks = null
    this.timer = null
  }

  private sendData():void {
    const { chunks } = this
    if (chunks) {
      this.chunks = null
      const buf = Buffer.concat(chunks)
      this.push(buf)
    }
  }

  // eslint-disable-next-line consistent-return
  public _transform(chunk: Buffer, _encoding: any, callback: any): void {
    const { chunks, timer } = this

    if (timer) clearTimeout(timer)

    if (chunk.length < MIN_SIZE) {
      if (!chunks) return callback(null, chunk)
      chunks.push(chunk)
      this.sendData()
      callback()
    } else {
      if (!chunks) {
        this.chunks = [chunk]
      } else {
        chunks.push(chunk)
      }

      this.timer = setTimeout(this.sendData.bind(this), 20)
      callback()
    }
  }

  public _flush(callback: any):void {
    const { chunks } = this
    if (chunks) {
      this.chunks = null
      const buf = Buffer.concat(chunks)
      callback(null, buf)
    } else {
      callback()
    }
  }
}
