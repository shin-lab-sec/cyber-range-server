import express, { Application } from 'express'
import { dockerCommand } from 'docker-cli-js'
import { client } from './libs/redis-client'
import cors from 'cors'
import { createHash } from 'crypto'

const CLIENT_URL = 'http://localhost:3000'
const PORT = process.env.PORT || 5000
const app: Application = express()

app.listen(PORT, () => {
  console.log('Server is running on port', PORT)
})

// parser設定
app.use(express.json())
app.use(
  express.urlencoded({
    extended: true,
  }),
)
// cors設定
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    optionsSuccessStatus: 200,
  }),
)

app.get('/redis', async (_req, res) => {
  await client.set('key', 'value')
  const value = await client.get('key')
  res.send({
    message: value + 'ffff',
  })
})

app.post('/docker', async (req, res) => {
  const command = req.body.command
  let result
  try {
    result = await dockerCommand(command)
    res.status(200).send(result)
  } catch (e) {
    result = { message: (e as Error).message }
    res.status(500).send(result)
  }
})

app.post('/terminal/start', async (req, res) => {
  const userId = req.body.userId

  // 起動するコンテナのportを用意
  let nextPorts
  const usedPorts = await client.get('usedPorts')
  if (usedPorts) {
    nextPorts = Number(usedPorts) + 1
  } else {
    nextPorts = 30000
  }
  await client.set('usedPorts', nextPorts)

  // 起動させた後、keyを生成しレスポンスとして返す
  try {
    await dockerCommand(
      `run -p ${nextPorts}:3000 -d --name ${userId} wetty yarn start --ssh-host 127.0.0.1 --base / --allow-iframe true`,
    )
    const hashKey = createHash('sha256')
      .update(`${userId}${nextPorts}`)
      .digest('hex')
    await client.set(hashKey, nextPorts)
    res.status(200).send({ key: hashKey })
  } catch (e) {
    res.status(500).send({ message: (e as Error).message })
  }
})

app.post('/terminal/delete', async (req, res) => {
  const userId = req.body.userId

  try {
    await dockerCommand(`container rm ${userId} -f`)
    res.status(200).send({ message: 'su' })
  } catch (e) {
    res.status(500).send({ message: (e as Error).message })
  }
})
