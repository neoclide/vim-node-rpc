import msgpack, { Codec } from 'msgpack-lite'
import Buffered from './buffered'
import { Metadata } from '../meta'
import { EventEmitter } from 'events'
const logger = require('../logger')('client')

class Response {
  private requestId: number
  private sent: boolean
  private encoder: NodeJS.WritableStream

  constructor(encoder: NodeJS.WritableStream, requestId: number, private codec: Codec) {
    this.encoder = encoder
    this.requestId = requestId
  }

  public send(resp: any, isError?: boolean): void {
    if (this.sent) {
      throw new Error(`Response to id ${this.requestId} already sent`)
    }
    this.encoder.write(
      msgpack.encode([
        1,
        this.requestId,
        isError ? [0, (resp instanceof Error) ? resp.message : resp] : null,
        !isError ? resp : null,
      ], { codec: this.codec })
    )
    this.sent = true
  }
}

interface ClientInfo {
  name: string
  version?: object
}

export default class Client extends EventEmitter {
  private pending: Map<number, Function> = new Map()
  private nextRequestId = 1
  private encodeStream: any
  private decodeStream: any
  private reader: NodeJS.ReadableStream
  private writer: NodeJS.WritableStream
  private codec: Codec
  private clientInfo: ClientInfo

  constructor(public readonly id: number) {
    super()
    const codec = this.setupCodec()
    this.encodeStream = msgpack.createEncodeStream({ codec })
    this.decodeStream = msgpack.createDecodeStream({ codec })
    this.decodeStream.on('data', (msg: any[]) => {
      this.parseMessage(msg)
    })
    this.decodeStream.on('end', () => {
      this.detach()
      this.emit('detach')
    })
  }

  public setClientInfo(info: ClientInfo): void {
    this.clientInfo = info
  }

  public get name(): string {
    return this.clientInfo ? this.clientInfo.name : ''
  }

  private setupCodec(): Codec {
    const codec = msgpack.createCodec()

    Metadata.forEach(
      ({ constructor }, id: number): void => {
        codec.addExtPacker(id, constructor, (obj: any) =>
          msgpack.encode(obj.id)
        )
        codec.addExtUnpacker(
          id,
          data => new constructor(msgpack.decode(data))
        )
      }
    )

    this.codec = codec
    return this.codec
  }

  public attach(
    writer: NodeJS.WritableStream,
    reader: NodeJS.ReadableStream,
  ): void {
    this.encodeStream = this.encodeStream.pipe(writer)
    const buffered = new Buffered()
    reader.pipe(buffered).pipe(this.decodeStream)
    this.writer = writer
    this.reader = reader
  }

  public detach(): void {
    this.encodeStream.unpipe(this.writer)
    this.reader.unpipe(this.decodeStream)
  }

  public request(method: string, args: any[]): Promise<any> {
    this.nextRequestId = this.nextRequestId + 1
    this.encodeStream.write(
      msgpack.encode([0, this.nextRequestId, method, args], {
        codec: this.codec
      })
    )
    return new Promise((resolve, reject) => {
      let resolved = false
      setTimeout(() => {
        if (resolved) return
        reject(new Error(`request "${method}" timeout after 3000`))
      }, 3000)
      this.pending.set(this.nextRequestId, (err, result) => {
        resolved = true
        if (err) return reject(err)
        resolve(result)
      })
    })
  }

  public notify(method: string, args: any[]): void {
    logger.debug('notification:', method, args)
    this.encodeStream.write(
      msgpack.encode([2, method, args], {
        codec: this.codec
      })
    )
  }

  // message from client
  private parseMessage(msg: any[]): void {
    const msgType = msg[0]
    logger.debug('message:', msg)
    if (msgType === 0) {
      // request
      //   - msg[1]: id
      //   - msg[2]: method name
      //   - msg[3]: arguments
      this.emit(
        'request',
        msg[2].toString(),
        msg[3],
        new Response(this.encodeStream, msg[1], this.codec)
      )
    } else if (msgType === 1) {
      // response to a previous request:
      //   - msg[1]: the id
      //   - msg[2]: error(if any)
      //   - msg[3]: result(if not errored)
      const id = msg[1]
      const handler = this.pending.get(id)
      this.pending.delete(id)
      handler(msg[2], msg[3])
    } else if (msgType === 2) {
      // notification/event
      //   - msg[1]: event name
      //   - msg[2]: arguments
      this.emit('notification', msg[1].toString(), msg[2] || [])
    } else {
      this.encodeStream.write([1, 0, 'Invalid message type', null])
    }
  }
}
