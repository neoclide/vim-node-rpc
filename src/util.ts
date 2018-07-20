import net from 'net'

let startPort = 8088

export function getPort():Promise<number> {
  return new Promise(resolve => {
    let server = net.createServer()
    server.listen(startPort, () => {
      server.once('close', () => {
        resolve(startPort)
      })
      server.close()
    })
    server.on('error', () => {
      startPort += 1
      getPort().then(res => {
        resolve(res)
      })
    })
  })
}
