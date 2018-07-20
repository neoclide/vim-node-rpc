import Connection from './connection'
import fs from 'fs'
import path from 'path'
import {Window, Buffer, Tabpage} from '../meta'
const logger = require('../logger')('model-request')

const timeout = 3000
const metaFile = path.join(__dirname, '../../data/api.json')
const metaData = JSON.parse(fs.readFileSync(metaFile, 'utf8'))

function commandEscape(str:string):string {
  return str.replace(/'/g, "''")
}

// request vim for result
export default class Request {
  private requestId = -1
  private pendingRequests:Set<()=>void> = new Set()
  private supportedFuncs:string[]

  constructor(private conn:Connection) {
    conn.once('ready', funcs => {
      this.supportedFuncs = funcs.map(s => 'nvim_' + s)
      let {pendingRequests} = this
      setTimeout(() => {
        for (let func of pendingRequests) {
          func()
        }
        this.pendingRequests = null
      }, 20)
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

  public eval(expr:string):Promise<any> {
    let {conn} = this
    let id = this.requestId
    this.requestId = this.requestId - 1
    return new Promise((resolve, reject) => {
      let called = false
      let cb = (requestId, res) => {
        called = true
        if (requestId == id) {
          resolve(res)
          conn.off('response', cb)
        }
      }
      let {isReady}  = this.conn
      if (isReady) {
        setTimeout(() => {
          if (called) return
          conn.off('response', cb)
          reject(new Error(`vim timeout after ${timeout}ms`))
        }, timeout)
      }
      conn.on('response', cb)
      if (!isReady) {
        this.pendingRequests.add(() => {
          conn.expr(id, expr)
        })
      } else {
        conn.expr(id, expr)
      }
    })
  }

  public call(func:string, args:any[]):Promise<any> {
    let {conn} = this
    let id = this.requestId
    this.requestId = this.requestId - 1
    return new Promise((resolve, reject) => {
      let called = false
      let cb = (requestId, res) => {
        called = true
        if (requestId == id) {
          resolve(res)
          conn.off('response', cb)
        }
      }
      let {isReady}  = this.conn
      if (isReady) {
        setTimeout(() => {
          if (called) return
          conn.off('response', cb)
          reject(new Error(`vim timeout after ${timeout}ms`))
        }, timeout)
      }
      conn.on('response', cb)
      if (!isReady) {
        this.pendingRequests.add(() => {
          conn.call(id, func, args)
        })
      } else {
        conn.call(id, func, args)
      }
    })
  }

  private command(str:string):Promise<void> {
    this.conn.commmand(str)
    return Promise.resolve(null)
  }

  public async callNvimFunction(method:string, args:any[]):Promise<any> {
    args = this.convertArgs(args || [])
    let {supportedFuncs} = this
          // return this.call('nvim#api#call', [method.slice(5), args || []])
    switch (method) {
      case 'nvim_tabpage_get_win': {
        let wid = await this.call('nvim#api#call', [method.slice(5), args])
        return new Window(wid)
      }
      case 'nvim_win_get_tabpage': {
        let tabnr = await this.call('nvim#api#call', [method.slice(5), args])
        return new Tabpage(tabnr)
      }
      case 'nvim_tabpage_list_wins': {
        let win_ids = await this.call('nvim#api#call', [method.slice(5), args])
        return win_ids.map(id => new Window(id))
      }
      case 'nvim_list_wins': {
        let win_ids = await this.call('nvim#api#call', [method.slice(5), []])
        return win_ids.map(id => new Window(id))
      }
      case 'nvim_call_function': {
        let [fn, list] = args
        return await this.call(fn, list)
      }
      case 'nvim_eval': {
        let [expr] = args
        return await this.eval(expr)
      }
      case 'nvim_buf_is_valid': {
        let [bufnr] = args
        return await this.call('bufexists', [bufnr])
      }
      case 'nvim_buf_get_var': {
        let [bufnr, name] = args
        return await this.call('getbufvar', [bufnr, name, null])
      }
      case 'nvim_buf_get_changedtick': {
        let [bufnr] = args
        return await this.call('getbufvar', [bufnr, 'changedtick', 0])
      }
      case 'Nvim_buf_set_var': {
        return await this.call('setbufvar', args)
      }
      case 'Nvim_buf_del_var': {
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
          return this.call('nvim#api#call', [method.slice(5), args || []])
        }
        console.error(`[vim-node-rpc] method ${method} not supported`) // tslint:disable-line
        return
    }
  }
}
