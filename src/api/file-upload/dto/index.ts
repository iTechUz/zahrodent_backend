import { IsString } from "class-validator";

import { IsNotEmpty } from "class-validator";

export class UploadFileDto {
	@IsNotEmpty()
	@IsString()
	file: string
}
