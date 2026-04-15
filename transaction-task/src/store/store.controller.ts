import { Body, Controller, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { UpdateEmailDto } from './dto/update-email.dto';
import { StoreService } from './store.service';

@Controller()
export class StoreController {
  constructor(private readonly store: StoreService) {}

  @Post('orders/place')
  placeOrder(@Body() dto: PlaceOrderDto) {
    return this.store.placeOrder(dto);
  }

  @Patch('customers/:id/email')
  updateEmail(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmailDto,
  ) {
    return this.store.updateCustomerEmail(id, dto);
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.store.createProduct(dto);
  }
}
