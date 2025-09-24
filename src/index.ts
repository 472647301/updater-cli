#!/usr/bin/env node
import chalk from 'chalk'
import { Command } from 'commander'
import { cosmiconfig } from 'cosmiconfig'
import packageConfig from '../package.json' with { type: 'json' }
import { adminLogin, fetchCacheData, to } from './utils.js'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { PlatformType, type Options } from './typing.js'
import { createWriteStream, createReadStream } from 'fs'
import { input } from '@inquirer/prompts'
import { homedir, platform } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import FormData from 'form-data'
import archiver from 'archiver'
import fetch from 'node-fetch'

export { PlatformType, type Options } from './typing.js'

const program = new Command()
const explorer = cosmiconfig('updater-cli')

const tagName = `${packageConfig.name}:`
const cachePath = join(homedir(), '.updater-cli')
const __dirname = dirname(fileURLToPath(import.meta.url))

const setCacheData = async (baseUrl: string) => {
  const username = await input({ message: 'Enter username' })
  if (!username) process.exit()
  const password = await input({ message: 'Enter password' })
  if (!password) process.exit()
  console.log(chalk.green(tagName, `Get login credentials`))
  const [err] = await to(adminLogin(baseUrl, username, password))
  if (err) {
    console.log(chalk.red(tagName, err))
  } else {
    console.log(chalk.green(tagName, 'Login successful'))
  }
  process.exit()
}

const uploadZipFile = async (
  token: string,
  config: Options,
  filePath: string
) => {
  console.log(chalk.green(tagName, `Start upload files`))
  if (!existsSync(filePath)) {
    console.log(chalk.red(tagName, `Missing ${filePath}`))
    process.exit()
  }
  const form = new FormData()
  if (config.desc) form.append('desc', config.desc)
  if (config.name) form.append('name', config.name)
  if (config.version) form.append('ver', config.version)
  if (config.channel) form.append('channel', config.channel)
  if (config.isMandatory) form.append('isMandatory', config.isMandatory)
  form.append('platform', config.platform.join(','))
  form.append('file', createReadStream(filePath))
  const response = await fetch(`${config.baseUrl}/version/upload`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form
  })
  const data = (await response.json()) as { code: number; message?: string }
  unlinkSync(filePath)
  if (!data) {
    console.log(chalk.red(tagName, 'File upload failed'))
    process.exit()
  }
  if (data.code) {
    console.log(chalk.red(tagName, 'File upload failed'))
    console.log(chalk.red(tagName, data.message))
    if (data.code === 401) {
      unlinkSync(cachePath)
    }
    process.exit()
  } else {
    console.log(chalk.green(tagName, JSON.stringify(data)))
  }
}

const updateVersion = async (token: string, config: Options) => {
  const iOS = config.platform.includes(PlatformType.iOS)
  const zipName = iOS ? 'main.jsbundle.zip' : 'index.android.bundle.zip'
  const isMobile = iOS || config.platform.includes(PlatformType.Android)
  if (isMobile) {
    await uploadZipFile(token, config, join(process.cwd(), `output/${zipName}`))
  } else {
    let outPath = 'dist/win-unpacked/resources/app.asar'
    if (platform() !== 'win32') {
      if (!config.productName) {
        console.log(chalk.red(tagName, 'Missing parameters productName'))
        process.exit()
      }
      outPath = `dist/mac-arm64/${config.productName}.app/Contents/Resources/app.asar`
    }
    console.log(chalk.green(tagName, `Start compressing files`))
    const output = createWriteStream(join(__dirname, '../app.zip'))
    const archive = archiver('zip', {
      zlib: { level: 9 } // 压缩级别，9 是最高级别
    })
    // 将压缩文件写入输出流
    archive.pipe(output)
    // 添加目录进行压缩
    archive.append(outPath, { name: 'app.asar' })
    // 压缩完成时执行操作
    archive.finalize()
    output.on('close', () => {
      console.log(
        chalk.green(
          tagName,
          `Compression completed, file size: ${archive.pointer()} bytes`
        )
      )
      uploadZipFile(token, config, output.path as string)
    })
  }
}

const updateAction = async (name: string) => {
  console.log(chalk.green(tagName, `${name} start uploading`))
  console.log(chalk.green(tagName, `Reading configuration`))
  const [err, res] = await to(
    explorer.load(join(process.cwd(), 'updater-cli.config.ts'))
  )
  if (err || !res) {
    console.log(chalk.red(tagName, err?.message || 'No updater-cli.ts file'))
    process.exit()
  }
  console.log(chalk.green(tagName, `Configuration read successfully`))
  const config = res.config as Options
  config.name = name || config.name
  if (!config.name) {
    console.log(chalk.red(tagName, 'Missing parameters name'))
    process.exit()
  }
  if (!config.baseUrl) {
    console.log(chalk.red(tagName, 'Missing parameters baseUrl'))
    process.exit()
  }
  if (!config.version) {
    console.log(chalk.red(tagName, 'Missing parameters version'))
    process.exit()
  }
  if (!config.platform.length) {
    console.log(chalk.red(tagName, 'Missing parameters platform'))
    process.exit()
  }
  if (!existsSync(cachePath)) {
    await setCacheData(config.baseUrl)
    return
  }
  const cacheContent = readFileSync(cachePath).toString()
  const cacheData = fetchCacheData(cacheContent)
  if (!cacheData.token) {
    await setCacheData(config.baseUrl)
  } else {
    await updateVersion(cacheData.token, config)
  }
}

program.version(packageConfig.version).description(packageConfig.description)

program.command('update <name>').action(updateAction)

program.parse(process.argv)

export const defineConfig = (options: Options) => {
  return options
}
