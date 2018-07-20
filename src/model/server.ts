import Emitter from 'events'
import os from 'os'
import net, {Server, Socket} from 'net'
import Client from './client'
import Request from './request'
const logger = require('../logger')('server')
const is_win = os.platform() == 'win32'

// a messagepack server
export default class MsgpackServer extends Emitter  {
  private server:Server
  private clients:Set<Client> = new Set()
  constructor(path:string, private requester:Request) {
    super()
    if (is_win) path = "\\\\.\\pipe\\" + path
    this.server = net.createServer(socket => {
      this.createClient(socket)
    })
    this.server.on('close', this.onClose.bind(this))
    this.server.on('error', this.onError.bind(this))
    this.server.listen(path, () => {
      this.emit('ready')
    })
  }

  private createClient(socket:Socket):void {
    let client = new Client()
    client.attach(socket, socket)
    this.clients.add(client)
    client.on('detach', () => {
      this.clients.delete(client)
    })
    client.on('request', (method, args, response) => {
      logger.debug('request', method, args)
      this.requester.callNvimFunction(method, args).then(result => {
        response.send(result, false)
      }, err => {
        response.send(err.message, true)
      })
    })
    // not used
    client.on('notification', (event, args) => {
      logger.info('Client event:', event, args)
    })
  }

  public notify(method:string, args:any[]):void {
    for (let client of this.clients) {
      client.notify(method, args)
    }
  }

  public request(method:string, args:any[]):Promise<any> {
    for (let client of this.clients) {
      return client.request(method, args)
    }
  }

  private onClose():void {
    this.clients.clear()
    this.emit('close')
  }

  private onError(err):void {
    logger.error('socket error: ', err.message)
  }
}
