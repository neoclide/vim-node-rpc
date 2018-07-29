import Emitter from 'events'
import net, {Server, Socket} from 'net'
import Client from './client'
import Request from './request'
const logger = require('../logger')('server')

// a messagepack server
export default class MsgpackServer extends Emitter  {
  private server:Server
  private clients:Client[] = []
  private clientId = 1
  constructor(path:string, private requester:Request) {
    super()
    this.server = net.createServer(socket => {
      this.createClient(socket, this.clientId)
      this.emit('connect', this.clientId)
      this.clientId = this.clientId + 1
    })
    this.server.on('close', this.onClose.bind(this))
    this.server.on('error', this.onError.bind(this))
    this.server.listen(path, () => {
      this.emit('ready')
    })
  }

  private createClient(socket:Socket, clientId:number):void {
    let client = new Client(clientId)
    client.attach(socket, socket)
    this.clients.push(client)
    client.on('detach', () => {
      let idx = this.clients.findIndex(o => o.id == clientId)
      if (idx !== -1) this.clients.splice(idx, 1)
      this.emit('disconnect', client.id)
    })
    client.on('request', (method, args, response) => {
      logger.debug('request', method, args)
      this.requester.callNvimFunction(method, args).then(result => {
        if (method == 'vim_get_api_info' || method == 'nvim_get_api_info') {
          // use clientId as neovim channelId
          result[0] = clientId
        }
        response.send(result, false)
      }, err => {
        logger.debug('request error', method, err.message)
        response.send(err, true)
      })
    })
    // not used
    client.on('notification', (event, args) => {
      logger.debug('Client event:', event, args)
      this.emit('notification', event, args)
    })
  }

  public notify(clientId:number, method:string, args:any[]):void {
    for (let client of this.clients) {
      if (clientId == 0) {
        client.notify(method, args)
      } else if (client.id == clientId) {
        client.notify(method, args)
      }
    }
  }

  public request(clientId:number, method:string, args:any[]):Promise<any> {
    let client = this.clients.find(o => o.id == clientId)
    if (!clientId) Promise.reject(new Error(`Client ${clientId} not found!`))
    return client.request(method, args)
  }

  private onClose():void {
    for (let client of this.clients) {
      client.detach()
    }
    this.clients = []
    this.emit('close')
  }

  private onError(err):void {
    logger.error('socket error: ', err.message)
  }
}
