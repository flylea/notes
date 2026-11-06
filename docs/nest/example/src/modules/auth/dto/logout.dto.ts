import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({ description: '传入后立即撤销该 refreshToken；不传则仅结束本次会话' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
