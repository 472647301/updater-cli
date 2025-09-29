import http from 'http'
import https from 'https'
import { writeFileSync } from 'fs'

export async function to<T, U = Error>(
  promise: Promise<T>,
  errorExt?: object
): Promise<[U, undefined] | [null, T]> {
  return promise
    .then<[null, T]>((data: T) => [null, data])
    .catch<[U, undefined]>((err: U) => {
      if (errorExt) {
        const parsedError = Object.assign({}, err, errorExt)
        return [parsedError, undefined]
      }
      return [err, undefined]
    })
}

export function fetchCacheData(content: string) {
  let token: string | undefined
  let username: string | undefined
  let password: string | undefined
  const arr = content.split('\n')
  for (const str of arr) {
    if (str.indexOf('token=') !== -1) {
      token = str.split('=')[1]
      continue
    }
    if (str.indexOf('username=') !== -1) {
      username = str.split('=')[1]
      continue
    }
    if (str.indexOf('password=') !== -1) {
      password = str.split('=')[1]
      continue
    }
  }
  return { token, username, password }
}

export async function adminLogin(
  baseUrl: string,
  username: string,
  password: string,
  cachePath: string
) {
  const uri = URL.parse(baseUrl)
  if (!uri) throw Error('baseUrl err')
  const postData = JSON.stringify({
    username: username,
    password: password
  })

  const isHttps = uri.protocol.indexOf('https') !== -1
  const api = isHttps ? https : http

  const options = {
    method: 'POST',
    port: uri.port,
    hostname: uri.hostname,
    path: `${uri.pathname}/admin/login`,
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData) // 计算数据长度
    }
  }
  return new Promise((resolve, reject) => {
    const req = api.request(options, res => {
      let data = ''
      res.on('data', chunk => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (typeof json.data === 'string' && json.data) {
            writeFileSync(
              cachePath,
              `token=${json.data}\nusername=${username}\npassword=${password}`,
              { encoding: 'utf-8' }
            )
            resolve(data)
          } else {
            reject('token err')
          }
        } catch (err) {
          reject(err)
        }
      })
    })
    req.on('error', err => reject(err))
    // 将数据写入请求主体
    req.write(postData)
    // 结束请求，发送数据
    req.end()
  })
}
