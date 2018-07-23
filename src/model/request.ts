import Connection from './connection'
import Emitter from 'events'
import fs from 'fs'
import path from 'path'
import {Window, Buffer, Tabpage} from '../meta'
const logger = require('../logger')('model-request')

const timeout = 3000
const metaFile = path.join(__dirname, '../../data/api.json')
const metaData = JSON.parse(fs.readFileSync(metaFile, 'utf8'))
const callMethod = 'nvim#api#call'

function commandEscape(str:string):string {
  return str.replace(/'/g, "''")
}

type RequestType = 'call' | 'expr'

class Response extends Emitter {
  private _resolved = false

  constructor(private type:RequestType, private expr?:string) {
    super()
    setTimeout(() => {
      if (!this._resolved) {
        this.emit('done', 'timeout after 3s', null)
      }
    }, timeout)
  }

  public resolve(result:any):void {
    if (this._resolved) return
    this._resolved = true
    if (this.type == 'call') {
      let [error, res] = result
      this.emit('done', error, res)
    } else if (this.type == 'expr') {
      if (result == 'ERROR') {
        this.emit('done', `vim (E15) invalid expression: ${this.expr}`, null)
      } else {
        this.emit('done', null, result)
      }
    }
  }

  public get result():Promise<any> {
    if (this._resolved) return
    return new Promise((resolve, reject):void => {
      this.once('done', (errMsg, result) => {
        this.removeAllListeners()
        if (errMsg) return reject(new Error(errMsg))
        resolve(result)
      })
    })
  }
}

// request vim for result
export default class Request {
  private requestId = -1
  private pendings:Map<number, Response> = new Map()
  private supportedFuncs:string[]
  private buffered:Function[] = []

  constructor(private conn:Connection) {
    conn.once('ready', funcs => {
      this.supportedFuncs = funcs.map(s => 'nvim_' + s)
      let {buffered} = this
      for (let func of buffered) {
        func()
      }
    })
    // only used for expr and call
    conn.on('response', (requestId, res) => {
      let response = this.pendings.get(requestId)
      if (!response) return
      response.resolve(res)
      this.pendings.delete(requestId)
    })
  }

  // convert to id before function call
  private convertArgs(args:any[]):any[] {
    return args.map(o => {
      if (o instanceof Window || o instanceof Buffer || o instanceof Tabpage) {
        return o.id
      }
      return o
    })
  }

  private eval(expr:string):Promise<any> {
    let {conn} = this
    let id = this.requestId
    this.requestId = this.requestId - 1
    let res = new Response('expr', expr)
    this.pendings.set(id, res)
    if (conn.isReady) {
      conn.expr(id, expr)
    } else {
      this.buffered.push(() => {
        conn.expr(id, expr)
      })
    }
    return res.result
  }

  private call(func:string, args:any[]):Promise<any> {
    let {conn} = this
    let id = this.requestId
    let isNative = !func.startsWith('nvim_')
    let fname = isNative ? func : func.slice(5)
    let arglist = [isNative ? 1 : 0, fname, args]
    this.requestId = this.requestId - 1
    let res = new Response('call')
    this.pendings.set(id, res)
    if (conn.isReady) {
      conn.call(id, callMethod, arglist)
    } else {
      this.buffered.push(() => {
        conn.call(id, callMethod, arglist)
      })
    }
    return res.result
  }

  private command(str:string):Promise<void> {
    this.conn.commmand(str)
    return Promise.resolve(null)
  }

  public async callNvimFunction(method:string, args:any[]):Promise<any> {
    args = this.convertArgs(args || [])
    let {supportedFuncs} = this
    switch (method) {
      case 'nvim_tabpage_get_win': {
        let wid = await this.call(method, args)
        return new Window(wid)
      }
      case 'nvim_win_get_tabpage': {
        let tabnr = await this.call(method, args)
        return new Tabpage(tabnr)
      }
      case 'nvim_tabpage_list_wins': {
        let win_ids = await this.call(method, args)
        return win_ids ? win_ids.map(id => new Window(id)) : []
      }
      case 'nvim_list_wins': {
        let win_ids = await this.call(method, args)
        return win_ids ? win_ids.map(id => new Window(id)) : []
      }
      case 'nvim_call_function': {
        let [fn, list] = args
        return await this.call(fn, list)
      }
      case 'nvim_eval': {
        return await this.eval(args[0])
      }
      case 'nvim_buf_get_var': {
        let [bufnr, name] = args
        return await this.call('getbufvar', [bufnr, name])
      }
      case 'nvim_buf_get_changedtick': {
        let [bufnr] = args
        return await this.call('getbufvar', [bufnr, 'changedtick', 0])
      }
      case 'nvim_buf_set_var': {
        return await this.call('setbufvar', args)
      }
      case 'nvim_buf_del_var': {
        let [bufnr, name] = args
        return await this.call('setbufvar', [bufnr, name, null])
      }
      case 'nvim_buf_get_option': {
        let [bufnr, opt] = args
        return await this.call('getbufvar', [bufnr, '&' + opt])
      }
      case 'nvim_buf_set_option': {
        let [bufnr, opt, value] = args
        return await this.call('setbufvar', [bufnr, '&' + opt, value])
      }
      case 'nvim_buf_get_name': {
        let [bufnr] = args
        return await this.eval(`fnamemodify(bufname(${bufnr}), ':p')`)
      }
      case 'nvim_list_runtime_paths': {
        return await this.eval(`split(&runtimepath, ',')`)
      }
      case 'nvim_command_output': {
        let [command] = args
        return await this.call('execute', [command, "slient"])
      }
      case 'nvim_get_current_line': {
        return await this.call('getline', ['.'])
      }
      case 'nvim_set_current_line': {
        let [line] = args
        return await this.call('setline', ['.', line])
      }
      case 'nvim_del_current_line': {
        return await this.call('execute', ['normal! dd'])
      }
      case 'nvim_get_var': {
        return await this.eval(`g:${args[0]}`)
      }
      case 'nvim_get_vvar': {
        return await this.eval(`v:${args[0]}`)
      }
      case 'nvim_get_option': {
        return await this.eval(`&${args[0]}`)
      }
      case 'nvim_get_current_buf': {
        let nr = await this.call('bufnr', ['%'])
        return new Buffer(nr)
      }
      case 'nvim_get_current_win': {
        let id = await this.call('win_getid', [])
        return new Window(id)
      }
      case 'nvim_get_current_tabpage': {
        let nr = await this.call('tabpagenr', [])
        return new Tabpage(nr)
      }
      case 'nvim_list_tabpages': {
        let nrs = await this.eval(`range(1, tabpagenr('$'))`)
        return nrs.map(nr => new Tabpage(Number(nr)))
      }
      case 'nvim_get_mode': {
        let mode = await this.call('mode', [])
        return {mode, blocking: false}
      }
      case 'vim_get_api_info':
      case 'nvim_get_api_info': {
        let channelId = await this.conn.channelId
        return [channelId, metaData]
      }
      case 'nvim_win_get_buf': {
        let id = await this.call('winbufnr', args)
        return new Buffer(id)
      }
      case 'nvim_call_dict_function': {
        let [dict, name, argumentList] = args
        return await this.call('call', [name, argumentList, dict])
      }
      case 'nvim_strwidth': {
        return await this.call('strwidth', [args[0]])
      }
      case 'nvim_out_write': {
        return await this.command(`echon '${commandEscape(args[0] as string)}'`)
      }
      case 'nvim_err_write': {
        return await this.command(`echoerr '${commandEscape(args[0] as string)}'`)
      }
      // TODO the behavior is not clear
      case 'nvim_err_writeln': {
        return await this.command(`echoerr '${commandEscape(args[0] as string)}'`)
      }
      case 'nvim_list_bufs': {
        let ids = await this.eval(`map(getbufinfo({'buflisted': 1}), 'v:val["bufnr"]')`)
        return ids.map(id => new Buffer(Number(id)))
      }
      case 'nvim_tabpage_get_number': {
        return args[0]
      }
      default:
        if (supportedFuncs.indexOf(method) !== -1) {
          return await this.call(method, args || [])
        }
        console.error(`[rpc.vim] method ${method} not supported`) // tslint:disable-line
        throw new Error(`Medhot ${method} not supported`)
    }
  }
}
