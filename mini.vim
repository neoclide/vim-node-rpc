scriptencoding utf-8
let s:save_cpo = &cpo
set cpo&vim

let root = expand('<sfile>:h')
execute 'set rtp+='.fnameescape(root)
call nvim#rpc#start_server()
let g:x = 1

let &cpo = s:save_cpo
unlet s:save_cpo
