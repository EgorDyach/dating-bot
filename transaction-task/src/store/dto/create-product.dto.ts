import { IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MaxLength(255)
  productName!: string;

  @IsNumber()
  @Min(0)
  price!: number;
}
