import type { AxiosInstance } from 'axios';
import axios from 'axios';
import type { RequestConfig } from '../types/request';

class Request {
  private instance: AxiosInstance;

  constructor(config: RequestConfig) {
    this.instance = axios.create(config);
    // 请求拦截器
    this.instance.interceptors.request.use(
      (requestConfig) => {
        return requestConfig;
      },
      (err) => {
        return err;
      },
    );

    // 对特定请求实例添加拦截器
    this.instance.interceptors.request.use(
      config.interceptors?.onReqResolve,
      config.interceptors?.onReqReject,
    );
    this.instance.interceptors.response.use(
      config.interceptors?.onResResolve,
      config.interceptors?.onResReject,
    );

    // 全局响应拦截器，保证最后执行
    this.instance.interceptors.response.use(
      (res) => {
        return res.data;
      },
      (err) => {
        return err;
      },
    );
  }

  request<T>(config: RequestConfig<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      // 创建配置副本以避免修改原始参数
      let requestConfig = config;

      // 如果我们为单个请求设置拦截器，这里使用单个请求的拦截器
      if (config.interceptors?.onReqReject) {
        requestConfig = config.interceptors.onReqReject(config as any);
      }
      this.instance
        .request<any, T>(requestConfig)
        .then((res) => {
          // 创建响应副本以避免修改原始响应
          let responseData = res;

          // 如果我们为单个响应设置拦截器，这里使用单个响应的拦截器
          if (config.interceptors?.onResResolve) {
            responseData = config.interceptors.onResResolve(res);
          }

          resolve(responseData);
        })
        .catch((err: any) => {
          reject(err);
        });
    });
  }

  // 其他请求方法
  // get
  get<T = any>(url: string, config?: RequestConfig): Promise<T>;
  get<T = any>(config: RequestConfig): Promise<T>;
  get<T = any>(urlOrConfig: string | RequestConfig, config?: RequestConfig): Promise<T> {
    if (typeof urlOrConfig === 'string') {
      // 简写形式：直接传入 URL
      return this.instance({ ...config, url: urlOrConfig, method: 'GET' });
    } else {
      // 完整形式：传入 RequestConfig 对象
      return this.instance({ ...urlOrConfig, method: 'GET' });
    }
  }

  // post
  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T>;
  post<T = any>(config: RequestConfig): Promise<T>;
  post<T = any>(
    urlOrConfig: string | RequestConfig,
    data?: any,
    config?: RequestConfig,
  ): Promise<T> {
    if (typeof urlOrConfig === 'string') {
      // 简写形式：直接传入 URL 和 data
      return this.instance({ ...config, url: urlOrConfig, data, method: 'POST' });
    } else {
      // 完整形式：传入 RequestConfig 对象
      return this.instance({ ...urlOrConfig, method: 'POST' });
    }
  }

  // put
  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T>;
  put<T = any>(config: RequestConfig): Promise<T>;
  put<T = any>(
    urlOrConfig: string | RequestConfig,
    data?: any,
    config?: RequestConfig,
  ): Promise<T> {
    if (typeof urlOrConfig === 'string') {
      // 简写形式：直接传入 URL 和 data
      return this.instance({ ...config, url: urlOrConfig, data, method: 'PUT' });
    } else {
      // 完整形式：传入 RequestConfig 对象
      return this.instance({ ...urlOrConfig, method: 'PUT' });
    }
  }

  // delete
  delete<T = any>(url: string, config?: RequestConfig): Promise<T>;
  delete<T = any>(config: RequestConfig): Promise<T>;
  delete<T = any>(urlOrConfig: string | RequestConfig, config?: RequestConfig): Promise<T> {
    if (typeof urlOrConfig === 'string') {
      // 简写形式：直接传入 URL
      return this.instance({ ...config, url: urlOrConfig, method: 'DELETE' });
    } else {
      // 完整形式：传入 RequestConfig 对象
      return this.instance({ ...urlOrConfig, method: 'DELETE' });
    }
  }

  // patch
  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<T>;
  patch<T = any>(config: RequestConfig): Promise<T>;
  patch<T = any>(
    urlOrConfig: string | RequestConfig,
    data?: any,
    config?: RequestConfig,
  ): Promise<T> {
    if (typeof urlOrConfig === 'string') {
      // 简写形式：直接传入 URL 和 data
      return this.instance({ ...config, url: urlOrConfig, data, method: 'PATCH' });
    } else {
      // 完整形式：传入 RequestConfig 对象
      return this.instance({ ...urlOrConfig, method: 'PATCH' });
    }
  }
}

export default Request;
