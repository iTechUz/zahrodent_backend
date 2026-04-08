declare enum SortOrder {
    ASC = "ASC",
    DESC = "DESC"
}
export declare class PaginationDto {
    page: number;
    pageSize: number;
    search: string;
    sortBy: SortOrder;
}
export declare class MetaDto {
    page: number;
    pageSize: number;
    pageCount: number;
    total: number;
}
export declare class PaginationResponse<T> {
    data: T[];
    meta: {
        page: number;
        pageSize: number;
        pageCount: number;
        total: number;
    };
}
export {};
