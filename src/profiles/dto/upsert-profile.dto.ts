import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertProfileDto {
  @IsString()
  @MaxLength(64)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsIn(['male', 'female'])
  genderCode?: 'male' | 'female';

  @IsOptional()
  @IsString()
  @MaxLength(128)
  city?: string;

  @IsOptional()
  @IsBoolean()
  isVisibleInFeed?: boolean;
}
