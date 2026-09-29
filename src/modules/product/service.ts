import { products, pricing_history, stock_movements } from '../../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { ProductInput, OpnameInput } from './schema';

export const getProducts = async (db: any, outletId: string) => {
  return await db.query.products.findMany({
    where: and(
      eq(products.outlet_id, outletId),
      isNull(products.deleted_at)
    )
  });
};

export const getProductById = async (db: any, outletId: string, id: string) => {
  return await db.query.products.findFirst({
    where: and(
      eq(products.id, id),
      eq(products.outlet_id, outletId),
      isNull(products.deleted_at)
    )
  });
};

export const createProduct = async (db: any, outletId: string, data: ProductInput) => {
  const [newProduct] = await db.insert(products).values({
    ...data,
    outlet_id: outletId,
  }).returning();
  return newProduct;
};

export const updateProduct = async (db: any, outletId: string, id: string, data: Partial<ProductInput>, userId: string) => {
  return await db.transaction(async (tx: any) => {
    const currentProduct = await tx.query.products.findFirst({
      where: and(
        eq(products.id, id),
        eq(products.outlet_id, outletId),
        isNull(products.deleted_at)
      )
    });

    if (!currentProduct) {
      throw new Error('Product not found');
    }

    if (data.price !== undefined && data.price !== currentProduct.price) {
      await tx.insert(pricing_history).values({
        product_id: id,
        outlet_id: outletId,
        field_changed: 'price',
        old_value: currentProduct.price,
        new_value: data.price,
        changed_by: userId
      });
    }

    if (data.cost_price !== undefined && data.cost_price !== currentProduct.cost_price) {
      await tx.insert(pricing_history).values({
        product_id: id,
        outlet_id: outletId,
        field_changed: 'cost_price',
        old_value: currentProduct.cost_price,
        new_value: data.cost_price,
        changed_by: userId
      });
    }

    const [updatedProduct] = await tx.update(products)
      .set({ ...data, updated_at: new Date() })
      .where(eq(products.id, id))
      .returning();

    return updatedProduct;
  });
};

export const deleteProduct = async (db: any, outletId: string, id: string) => {
  const [deletedProduct] = await db.update(products)
    .set({ deleted_at: new Date() })
    .where(and(eq(products.id, id), eq(products.outlet_id, outletId)))
    .returning();
  return deletedProduct;
};

export const performOpname = async (db: any, outletId: string, userId: string, data: OpnameInput) => {
  return await db.transaction(async (tx: any) => {
    const current = await tx.query.products.findFirst({
      where: and(
        eq(products.id, data.product_id),
        eq(products.outlet_id, outletId),
        isNull(products.deleted_at)
      )
    });

    if (!current) {
      throw new Error('Product not found');
    }
    
    if (!current.track_stock) {
      throw new Error('Product does not track stock');
    }

    const quantity = data.actual_stock - current.stock;

    if (quantity !== 0) {
      await tx.insert(stock_movements).values({
        product_id: data.product_id,
        outlet_id: outletId,
        type: 'opname',
        quantity: quantity,
        notes: data.notes || 'Stock opname',
        created_by: userId
      });
      
      await tx.update(products)
        .set({ stock: data.actual_stock, updated_at: new Date() })
        .where(eq(products.id, data.product_id));
    }

    let shouldUpdatePrice = false;
    let priceUpdate: any = {};

    if (data.price !== undefined && data.price !== current.price) {
      await tx.insert(pricing_history).values({
        product_id: data.product_id,
        outlet_id: outletId,
        field_changed: 'price',
        old_value: current.price,
        new_value: data.price,
        changed_by: userId
      });
      priceUpdate.price = data.price;
      shouldUpdatePrice = true;
    }

    if (data.cost_price !== undefined && data.cost_price !== current.cost_price) {
      await tx.insert(pricing_history).values({
        product_id: data.product_id,
        outlet_id: outletId,
        field_changed: 'cost_price',
        old_value: current.cost_price,
        new_value: data.cost_price,
        changed_by: userId
      });
      priceUpdate.cost_price = data.cost_price;
      shouldUpdatePrice = true;
    }

    if (shouldUpdatePrice) {
      await tx.update(products)
        .set({ ...priceUpdate, updated_at: new Date() })
        .where(eq(products.id, data.product_id));
    }

    return true;
  });
};
