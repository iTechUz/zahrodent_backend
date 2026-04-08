export declare class HashingService {
    saltOrRounds: number;
    constructor();
    hashPassword(password: string): Promise<string>;
    comparePassword(password: string, hashedPassword: string): Promise<boolean>;
}
