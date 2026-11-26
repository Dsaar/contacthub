import { loadServerConfig } from './config.ts'
import { app } from './app.ts'

const { port } = loadServerConfig()
const host = '127.0.0.1'

app.listen(port, host, (error) => {
  if (error) throw error
  console.log(`ContactHub API listening at http://${host}:${port}`)
})
