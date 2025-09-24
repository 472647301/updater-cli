export declare function to<T, U = Error>(promise: Promise<T>, errorExt?: object): Promise<[U, undefined] | [null, T]>;
export declare function fetchCacheData(content: string): {
    token: string | undefined;
    username: string | undefined;
    password: string | undefined;
};
export declare function adminLogin(baseUrl: string, username: string, password: string): Promise<unknown>;
