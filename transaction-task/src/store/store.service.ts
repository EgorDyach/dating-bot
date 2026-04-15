import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { PlaceOrderDto } from './dto/place-order.dto';
import { UpdateEmailDto } from './dto/update-email.dto';

@Injectable()
export class StoreService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Сценарий 1: размещение заказа в одной транзакции —
   * запись Orders, строки OrderItems с Subtotal, затем пересчёт TotalAmount.
   */
  async placeOrder(dto: PlaceOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) {
        throw new NotFoundException(`Customer ${dto.customerId} not found`);
      }

      const lines: Array<{
        productId: number;
        quantity: number;
        subtotal: Prisma.Decimal;
      }> = [];

      for (const item of dto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product) {
          throw new NotFoundException(`Product ${item.productId} not found`);
        }
        const subtotal = product.price.mul(item.quantity);
        lines.push({
          productId: item.productId,
          quantity: item.quantity,
          subtotal,
        });
      }

      const order = await tx.order.create({
        data: {
          customerId: dto.customerId,
          totalAmount: new Prisma.Decimal(0),
        },
      });

      await tx.orderItem.createMany({
        data: lines.map((l) => ({
          orderId: order.id,
          productId: l.productId,
          quantity: l.quantity,
          subtotal: l.subtotal,
        })),
      });

      const sum = lines.reduce(
        (acc, l) => acc.add(l.subtotal),
        new Prisma.Decimal(0),
      );

      return tx.order.update({
        where: { id: order.id },
        data: { totalAmount: sum },
        include: { items: true, customer: true },
      });
    });
  }

  /**
   * Сценарий 2: атомарное обновление email клиента (одна транзакция).
   */
  async updateCustomerEmail(customerId: number, dto: UpdateEmailDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findUnique({
        where: { id: customerId },
      });
      if (!existing) {
        throw new NotFoundException(`Customer ${customerId} not found`);
      }
      return tx.customer.update({
        where: { id: customerId },
        data: { email: dto.email },
      });
    });
  }

  /**
   * Сценарий 3: атомарное добавление продукта.
   */
  async createProduct(dto: CreateProductDto) {
    return this.prisma.$transaction(async (tx) => {
      return tx.product.create({
        data: {
          productName: dto.productName,
          price: new Prisma.Decimal(dto.price),
        },
      });
    });
  }
}
