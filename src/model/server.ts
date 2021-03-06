import Emitter from 'events'
import net, { Server, Socket } from 'net'
import Client from './client'
import Request from './request'
import path from 'path'
import fs from 'fs'
const logger = require('../logger')('server')

const metaFile = path.join(__dirname, '../../data/api.json')
const metaData = JSON.parse(fs.readFileSync(metaFile, 'utf8'))

// a messagepack server
export default class MsgpackServer extends Emitter {
  private server: Server
  private clients: Client[] = []
  constructor(path: string, private requester: Request) {
    super()
    let clientId = 1
    this.server = net.createServer(socket => {
      let client = this.createClient(socket, clientId)
      clientId = clientId + 1
      this.emit('connect', client.id)
    })
    this.server.on('close', this.onClose.bind(this))
    this.server.on('error', this.onError.bind(this))
    this.server.listen(path, () => {
      this.emit('ready')
    })
  }

  private hasClient(name: string): boolean {
    return this.clients.find(c => c.name == name) != null
  }

  private createClient(socket: Socket, clientId: number): Client {
    let client = new Client(clientId)
    client.attach(socket, socket)
    this.clients.push(client)
    client.on('detach', () => {
      let idx = this.clients.findIndex(o => o.id == clientId)
      if (idx !== -1) this.clients.splice(idx, 1)
      this.emit('disconnect', client.id)
    })
    let id = 1
    let setClientInfo = (name: string, version: object): void => {
      if (this.hasClient(name)) {
        logger.error(`client ${name} exists!`)
      }
      client.setClientInfo({ name, version })
      this.emit('client', client.id, name)
    }
    client.on('request', (method, args, response) => {
      let rid = id
      id = id + 1
      if (method == 'vim_get_api_info' || method == 'nvim_get_api_info') {
        let res = [clientId, metaData]
        response.send(res, false)
        return
      }
      if (method == 'nvim_set_client_info') {
        setClientInfo(args[0], args[1])
        response.send(null, false)
        return
      }
      this.requester.callNvimFunction(method, args).then(result => {
        response.send(result, false)
      }, err => {
        logger.error(`request error ${rid}: `, err.message)
        response.send(err, true)
      })
    })
    client.on('notification', (event, args) => {
      if (event == 'nvim_command') {
        this.requester.command(args[0])
        return
      }
      if (event == 'nvim_set_client_info') {
        setClientInfo(args[0], args[1])
        return
      }
      this.emit('notification', event, args)
    })
    return client
  }

  public notify(clientId: number, method: string, args: any[]): void {
    for (let client of this.clients) {
      if (clientId == 0) {
        client.notify(method, args)
      } else if (client.id == clientId) {
        client.notify(method, args)
      }
    }
  }

  public request(clientId: number, method: string, args: any[]): Promise<any> {
    let client = this.clients.find(o => o.id == clientId)
    if (!clientId) Promise.reject(new Error(`Client ${clientId} not found!`))
    return client.request(method, args)
  }

  private onClose(): void {
    for (let client of this.clients) {
      client.detach()
    }
    this.clients = []
    this.emit('close')
  }

  private onError(err): void {
    logger.error('socket error: ', err.message)
  }
}
