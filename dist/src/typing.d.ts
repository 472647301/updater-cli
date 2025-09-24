export declare enum PlatformType {
    iOS = "ios",
    Android = "android",
    Windows = "windows",
    Linux = "linux",
    Mac = "mac"
}
export interface Options {
    /**
     * 应用名称
     * */
    name: string;
    /**
     * 版本号
     * */
    version: string;
    /**
     * 更新描述
     * */
    desc?: string;
    /**
     * 平台
     * */
    platform: PlatformType[];
    /**
     * 渠道
     * */
    channel?: string;
    /**
     * 是否强制更新
     * */
    isMandatory?: number;
    baseUrl: string;
    /**
     * 产品名称 桌面端会用到
     * */
    productName?: string;
}
