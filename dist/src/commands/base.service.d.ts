import { PaginationDto } from '@/utils/paginations';
import { Type } from '@nestjs/common';
import { IUserProfileDto } from '@/services/user/dto';
export declare function CrudController<TCreate, TUpdate>(CreateDto: Type<TCreate>, UpdateDto: Type<TUpdate>): abstract new (service: any) => {
    readonly service: any;
    findAll(query: PaginationDto, user: IUserProfileDto): Promise<any>;
    findOne(id: string, user: IUserProfileDto): any;
    create(dto: TCreate, user: IUserProfileDto): any;
    update(id: string, dto: TUpdate, user: IUserProfileDto): any;
    remove(id: string, user: IUserProfileDto): any;
};
