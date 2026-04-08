type Constructor<T = {}> = new (...args: any[]) => T;
declare function ApiMixin<TBase extends Constructor>(Base: TBase): {
    new (...args: any[]): {
        apiMethod(): void;
    };
} & TBase;
declare function BaseMixin<TBase extends Constructor>(Base: TBase): {
    new (...args: any[]): {
        baseMethod(): void;
    };
} & TBase;
