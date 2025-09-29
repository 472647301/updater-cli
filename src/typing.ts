export enum PlatformType {
  iOS = 'ios',
  Android = 'android',
  Windows = 'windows',
  Linux = 'linux',
  Mac = 'mac'
}

export interface VersionEntity {
  id: number
  /** 版本号 */
  version: number
  /** 更新描述 */
  desc: string | null
  /** 应用名称 */
  name: string
  /** 下载链接 */
  downloadUrl: string | null
  /** 平台 多平台用逗号拼接 ios,android */
  platform: string
  /** 文件大小 */
  fileSize: number | null
  /** 上传者IP */
  ip: string
  /** 渠道 appstore或其它,用于全量更新下发不同的链接 */
  channel: string | null
  /** 0-热更新包,1-全量更新包 */
  type: number
  /** 是否启用 */
  enable: number
  /** 是否强制更新 */
  isMandatory: number
  /** 更新时间 */
  updateTime: Date
  /** 创建时间 */
  createTime: Date
}

export interface Options {
  /**
   * 应用名称
   * */
  name: string
  /**
   * 版本号
   * */
  version: string
  /**
   * 更新描述
   * */
  desc?: string
  /**
   * 平台
   * */
  platform: PlatformType[]
  /**
   * 渠道
   * */
  channel?: string
  /**
   * 是否强制更新
   * */
  isMandatory?: number
  baseUrl: string
  /**
   * 产品名称 桌面端会用到
   * */
  productName?: string
  success?: (data: VersionEntity) => void
}
