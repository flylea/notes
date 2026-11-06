import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { Role } from '../../../common/enums.js';
import { UpdateProfileDto } from './update-profile.dto.js';

/** 管理员更新用户时比本人多一个 role 字段。 */
export class UpdateUserDto extends UpdateProfileDto {
  @ApiPropertyOptional({ description: '角色', enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
